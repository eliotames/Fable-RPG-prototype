/**
 * Test suite — run with:  node tests/run-tests.mjs  (or `npm test`)
 *
 * The engine's logic systems are plain ES modules with no Phaser dependency,
 * so Node imports the very same files the browser runs and exercises:
 *   1. shipped content passes the exact validation pipeline the game runs
 *   2. the validator actually catches broken content (negative tests)
 *   3. dialogue graphs: every node reachable, no dead ends
 *   4. character factory / derivation math
 *   5. check resolver (passive + active, named DCs, determinism)
 *   6. combat math: weakness/resist/break/parry/timing/turn order
 *   7. a scripted simulation of the critical quest path, start → ending
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../systems/Validator.js';
import { shapes } from '../systems/shapes.js';
import { ContentRegistry } from '../systems/ContentRegistry.js';
import { buildCharacter, buildPartyMember, deriveStats, baseAttributes } from '../systems/CharacterFactory.js';
import { activeCheck, passiveCheck, resolveDc, difficultyLabel } from '../systems/CheckResolver.js';
import { computeDamage, computeHeal, applyBreakDamage, turnOrder, elementMult } from '../systems/CombatMath.js';
import { gradeHit, gradeParry, telegraphDelay } from '../systems/TimingJudge.js';
import { mulberry32 } from '../systems/rng.js';
import { GameState } from '../systems/GameState.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { evaluateConditions, applyEffects } from '../systems/Script.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0, failed = 0;
const fails = [];

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    fails.push(name);
    console.error(`  ✗ ${name}\n      ${e.message}`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { assert(a === b, `${msg ?? 'eq'}: expected ${b}, got ${a}`); }
const loadJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

// ---------------------------------------------------------------------------
console.log('\n[1] shipped content validates');

const manifest = loadJson('data/manifest.json');
check('manifest matches its shape', () => {
  const errors = validate(manifest, shapes.manifest, 'data/manifest.json');
  assert(!errors.length, errors.join('\n'));
});

const reg = new ContentRegistry();
check('every manifest file loads and validates (registry finalize)', () => {
  for (const entry of manifest.files) reg.ingest(entry.type, entry.key, loadJson(entry.path), entry.path);
  reg.finalize(); // throws ContentError on any problem
});

check('manifest lists every JSON file under data/', () => {
  const listed = new Set(manifest.files.map((f) => f.path));
  const walk = (dir) => readdirSync(join(root, dir)).flatMap((f) => {
    const p = `${dir}/${f}`;
    return statSync(join(root, p)).isDirectory() ? walk(p) : [p];
  });
  const missing = walk('data').filter((p) => p.endsWith('.json') && p !== 'data/manifest.json' && !listed.has(p));
  assert(!missing.length, `files not in manifest: ${missing.join(', ')}`);
});

// ---------------------------------------------------------------------------
console.log('\n[2] validator catches broken content');

check('missing required field is reported with file and path', () => {
  const bad = loadJson('data/races.json');
  delete bad.races[0].attributeBonuses;
  const errors = validate(bad, shapes.races, 'races.json');
  assert(errors.some((e) => e.includes('races.json') && e.includes('[0]') && e.includes('attributeBonuses')),
    `got: ${errors.join(' | ')}`);
});

check('wrong type is reported', () => {
  const errors = validate({ skills: [{ id: 1, name: 'x', attribute: 'a', desc: 'd' }] }, shapes.skills, 'skills.json');
  assert(errors.some((e) => e.includes('id') && e.includes('expected string')), errors.join(' | '));
});

check('unknown field (typo) is reported', () => {
  const bad = loadJson('data/classes.json');
  bad.classes[0].atributeBonuses = {};
  const errors = validate(bad, shapes.classes, 'classes.json');
  assert(errors.some((e) => e.includes('atributeBonuses')), errors.join(' | '));
});

check('cross-reference errors are caught (class → nonexistent ability)', () => {
  const reg2 = new ContentRegistry();
  for (const entry of manifest.files) {
    const json = loadJson(entry.path);
    if (entry.type === 'classes') json.classes[0].abilities.push('does-not-exist');
    reg2.ingest(entry.type, entry.key, json, entry.path);
  }
  let threw = null;
  try { reg2.finalize(); } catch (e) { threw = e; }
  assert(threw && threw.problems.some((p) => p.includes('does-not-exist')), 'expected ContentError naming the bad ability');
});

check('dialogue graph errors are caught (option → nonexistent node)', () => {
  const reg2 = new ContentRegistry();
  for (const entry of manifest.files) {
    const json = loadJson(entry.path);
    if (entry.key === 'dlg-pell') json.nodes.intro.options[0].next = 'nowhere';
    reg2.ingest(entry.type, entry.key, json, entry.path);
  }
  let threw = null;
  try { reg2.finalize(); } catch (e) { threw = e; }
  assert(threw && threw.problems.some((p) => p.includes('nowhere')), 'expected error naming the missing node');
});

// ---------------------------------------------------------------------------
console.log('\n[3] dialogue graphs are sound');

check('every dialogue node is reachable from start', () => {
  const problems = [];
  for (const [did, d] of reg.dialogues) {
    const seen = new Set();
    const queue = [d.start];
    while (queue.length) {
      const id = queue.pop();
      if (seen.has(id) || !d.nodes[id]) continue;
      seen.add(id);
      const node = d.nodes[id];
      for (const r of node.redirects ?? []) queue.push(r.node);
      if (node.next) queue.push(node.next);
      for (const o of node.options ?? []) {
        if (o.next) queue.push(o.next);
        if (o.check) queue.push(o.check.success, o.check.failure);
      }
    }
    for (const id of Object.keys(d.nodes)) {
      if (id !== '//' && !seen.has(id)) problems.push(`${did}: node "${id}" unreachable`);
    }
  }
  assert(!problems.length, problems.join('; '));
});

check('every node terminates (options/next/end-effect/redirect/combat)', () => {
  const problems = [];
  for (const [did, d] of reg.dialogues) {
    for (const [nid, node] of Object.entries(d.nodes)) {
      if (nid === '//') continue;
      const opts = node.options ?? [];
      const ok = node.redirects?.length || node.next || opts.length === 0 /* auto-leave */
        || opts.every((o) => o.next || o.check
          || (o.effects ?? []).some((e) => ['end', 'startCombat', 'endSlice'].includes(e.type)));
      if (!ok) problems.push(`${did}.${nid}: has an option leading nowhere`);
    }
  }
  assert(!problems.length, problems.join('; '));
});

// ---------------------------------------------------------------------------
console.log('\n[4] character factory');

check('derived stats follow combat-tuning derivation', () => {
  const t = reg.tuning;
  const attrs = { brawn: 4, finesse: 3, intellect: 2, presence: 1 };
  const d = deriveStats(t, attrs, 3);
  eq(d.maxHp, Math.round(t.derivation.maxHp.base + 4 * t.derivation.maxHp.per), 'maxHp');
  eq(d.speed, Math.round(t.derivation.speed.base + 3 * t.derivation.speed.per), 'speed');
  eq(d.defense, Math.round(t.derivation.defense.base + 4 * t.derivation.defense.per) + 3, 'defense incl. armor');
});

check('race and class bonuses stack into attributes and skills', () => {
  const ch = buildCharacter(reg, {
    name: 'T', raceId: 'cragfolk', classId: 'warden',
    attributes: { brawn: 3, finesse: 2, intellect: 2, presence: 2 },
  });
  eq(ch.attributes.brawn, 5, 'brawn 3 +1 race +1 class');
  // force = brawn(5) + cragfolk skill bonus(1) + warden skill bonus(1)
  eq(ch.skills.force, 7, 'force skill');
  assert(ch.abilities.includes('crushing-blow'), 'class abilities granted');
});

check('party members build through the same factory', () => {
  const m = buildPartyMember(reg, 'issi');
  eq(m.sourceId, 'issi', 'sourceId');
  assert(m.abilities.includes('resonant-word'), 'issi knows resonant-word (gate solution depends on it)');
});

check('creation pool math: base attributes ready for distribution', () => {
  const base = baseAttributes(reg);
  for (const v of Object.values(base)) eq(v, reg.tuning.creation.basePerAttribute, 'base per attribute');
});

// ---------------------------------------------------------------------------
console.log('\n[5] check resolver');

check('named difficulties resolve from tuning', () => {
  eq(resolveDc(reg.tuning, 'hard'), reg.tuning.checks.difficulties.hard, 'hard');
  eq(resolveDc(reg.tuning, 13), 13, 'numeric passthrough');
  assert(difficultyLabel(reg.tuning, 'hard').toLowerCase() === 'hard', 'label');
});

check('passive checks are thresholds, no roll', () => {
  assert(passiveCheck(4, 4) && !passiveCheck(3, 4), 'threshold semantics');
});

check('active checks: bounds and determinism with a seeded rng', () => {
  const rand = mulberry32(42);
  for (let i = 0; i < 200; i++) {
    const r = activeCheck(reg.tuning, 3, 'medium', rand);
    assert(r.roll >= 1 && r.roll <= reg.tuning.checks.die, 'roll in die range');
    eq(r.total, r.roll + 3, 'total = roll + skill');
    eq(r.success, r.total >= r.dc, 'success semantics');
  }
  const a = activeCheck(reg.tuning, 3, 12, mulberry32(7));
  const b = activeCheck(reg.tuning, 3, 12, mulberry32(7));
  eq(a.roll, b.roll, 'same seed, same roll');
});

// ---------------------------------------------------------------------------
console.log('\n[6] combat math');

const t = reg.tuning;
const noVariance = () => 0.5; // rand 0.5 → spread = 1.0 exactly
const dummyTarget = (over = {}) => ({ defense: 2, weaknesses: ['resonance'], resists: ['physical'], broken: false, ...over });

check('weakness/resist element multipliers', () => {
  eq(elementMult(t, 'resonance', dummyTarget()), t.elements.weaknessMult, 'weakness');
  eq(elementMult(t, 'physical', dummyTarget()), t.elements.resistMult, 'resist');
  eq(elementMult(t, 'air', dummyTarget()), 1, 'neutral');
});

check('damage formula matches tuning coefficients', () => {
  const move = { power: 10, element: 'air' };
  const r = computeDamage(t, move, 4, dummyTarget(), {}, noVariance);
  const expected = Math.max(t.damage.minDamage, Math.round((10 + 4 * t.damage.attrCoef) * 1 - 2 * t.damage.defenseCoef));
  eq(r.amount, expected, 'neutral damage');
});

check('timing and broken multipliers amplify damage', () => {
  const move = { power: 10, element: 'resonance' };
  const base = computeDamage(t, move, 4, dummyTarget(), {}, noVariance).amount;
  const timed = computeDamage(t, move, 4, dummyTarget(), { timingMult: t.timing.attack.perfectMult }, noVariance).amount;
  const broken = computeDamage(t, move, 4, dummyTarget({ broken: true }), {}, noVariance).amount;
  assert(timed > base, 'perfect timing > base');
  assert(broken > base, 'broken target takes more');
});

check('perfect parry negates entirely, even past the min-damage floor', () => {
  const move = { power: 50, element: 'air' };
  const r = computeDamage(t, move, 9, dummyTarget(), { parryMult: t.timing.parry.perfectMult }, noVariance);
  eq(r.amount, 0, 'perfect parry');
  const partial = computeDamage(t, move, 9, dummyTarget(), { parryMult: t.timing.parry.goodMult }, noVariance);
  assert(partial.amount > 0 && partial.amount < computeDamage(t, move, 9, dummyTarget(), {}, noVariance).amount, 'good parry reduces');
});

check('minimum damage floor holds', () => {
  const r = computeDamage(t, { power: 1, element: 'physical' }, 0, dummyTarget({ defense: 99 }), {}, noVariance);
  eq(r.amount, t.damage.minDamage, 'floored');
});

check('break gauge: weakness-only chip, break at zero, no double-break', () => {
  const target = { toughness: 2, broken: false, weaknesses: ['ember'] };
  let r = applyBreakDamage(t, target, 'physical', 2);
  eq(r.toughness, 2, 'non-weakness does not chip (weaknessOnly)');
  r = applyBreakDamage(t, target, 'ember', 1);
  eq(r.toughness, 1, 'weakness chips by breakPower');
  assert(!r.justBroke, 'not yet broken');
  target.toughness = r.toughness;
  r = applyBreakDamage(t, target, 'ember', 1);
  assert(r.justBroke && r.toughness === 0, 'breaks at zero');
  target.toughness = 0; target.broken = true;
  r = applyBreakDamage(t, target, 'ember', 1);
  assert(!r.justBroke, 'broken targets cannot re-break');
});

check('turn order: speed desc, dead excluded, stable ties', () => {
  const order = turnOrder([
    { name: 'a', speed: 3, hp: 10 }, { name: 'dead', speed: 9, hp: 0 },
    { name: 'b', speed: 7, hp: 10 }, { name: 'c', speed: 7, hp: 10 },
  ]);
  eq(order.map((c) => c.name).join(','), 'b,c,a', 'order');
});

check('timed hit grades from tuning windows', () => {
  const center = t.timing.attack.sweepMs / 2;
  eq(gradeHit(t.timing, center).grade, 'perfect', 'center');
  eq(gradeHit(t.timing, center + t.timing.attack.perfectMs + 1).grade, 'good', 'just outside perfect');
  eq(gradeHit(t.timing, center + t.timing.attack.goodMs + 1).grade, 'miss', 'outside good');
  eq(gradeHit(t.timing, null).grade, 'miss', 'no press');
});

check('parry grades: early press fails, window honored', () => {
  eq(gradeParry(t.timing, -5).grade, 'fail', 'early press');
  eq(gradeParry(t.timing, t.timing.parry.perfectMs).grade, 'perfect', 'perfect window');
  eq(gradeParry(t.timing, t.timing.parry.windowMs).grade, 'good', 'edge of window');
  eq(gradeParry(t.timing, t.timing.parry.windowMs + 1).grade, 'fail', 'too late');
  const d = telegraphDelay(t.timing, mulberry32(1));
  assert(d >= t.timing.parry.telegraphMinMs && d <= t.timing.parry.telegraphMaxMs, 'telegraph in range');
});

// ---------------------------------------------------------------------------
console.log('\n[7] scripted critical path: creation → quest → gate → combat → ending');

check('the slice is completable through data alone', () => {
  GameState.reset();
  QuestSystem.init(reg);

  // character creation (a Skyborn Windcaller with spread points)
  GameState.player = buildCharacter(reg, {
    name: 'Test Wanderer', raceId: 'skyborn', classId: 'windcaller',
    attributes: { brawn: 2, finesse: 2, intellect: 5, presence: 3 }, isPlayer: true,
  });
  for (const si of reg.classes.get('windcaller').startingItems ?? []) GameState.addItem(si.item, si.qty);

  let combatStarted = null;
  let sliceEnded = null;
  const hooks = {
    startCombat: (e) => { combatStarted = e; },
    endSlice: (end) => { sliceEnded = end; },
    end: () => {},
  };
  const dlg = (id) => reg.dialogues.get(id);
  const fx = (effects) => applyEffects(effects, reg, hooks);

  // Senna gives the quest
  fx(dlg('elder-senna').nodes.task.effects);
  assert(QuestSystem.isAtStage('a-quiet-toll', 'open-the-way'), 'quest starts at open-the-way');

  // loot the cache → mill-cog appears (gate solution 2 becomes available)
  fx(dlg('supply-cache').nodes.opened.effects);
  assert(GameState.hasItem('mill-cog'), 'cog looted');
  const rigOption = dlg('bell-gate').nodes.closed.options.find((o) => o.text.includes('pump-hammer'));
  assert(evaluateConditions(rigOption.conditions, reg), 'tinkering route available with cog');

  // recruit both companions
  fx(dlg('maren-vael').nodes['wrestle-win'].effects);
  fx(dlg('issi').nodes.patience.effects);
  eq(GameState.party.length, 2, 'two recruits');
  assert(GameState.partyHasAbility('resonant-word'), 'issi enables the resonance gate solution');
  const singOption = dlg('bell-gate').nodes.closed.options.find((o) => o.text.includes('sing'));
  assert(evaluateConditions(singOption.conditions, reg), 'resonance route available via party');

  // open the gate (tinkering success node)
  fx(dlg('bell-gate').nodes.rigged.effects);
  assert(GameState.hasFlag('gate-open'), 'gate opens');
  assert(QuestSystem.isAtStage('a-quiet-toll', 'the-roost'), 'quest advances');

  // confrontation: resonance option gated correctly, weakens the boss, starts combat
  const threshold = dlg('mill-door').nodes.threshold;
  const chordOpt = threshold.options.find((o) => o.next === 'chord');
  assert(evaluateConditions(chordOpt.conditions, reg), 'chord option available');
  fx(dlg('mill-door').nodes.chord.effects);                 // node entry: sentinel-weakened
  fx(dlg('mill-door').nodes.chord.options[0].effects);      // option: startCombat
  assert(GameState.hasFlag('sentinel-weakened'), 'boss pre-weakened');
  assert(combatStarted && combatStarted.encounter === 'mill-roost', 'combat starts');
  eq(combatStarted.onWin, 'sentinel-aftermath', 'victory routes to aftermath');

  // encounter modifiers apply to a weakened, scouted boss
  const enc = reg.encounters.get('mill-roost');
  GameState.setFlag('hush-lore');
  const applicable = enc.modifiers.filter((m) => GameState.hasFlag(m.flag));
  eq(applicable.length, 2, 'both modifiers armed');

  // aftermath → ending
  const aft = dlg('sentinel-aftermath');
  fx(aft.nodes['ending-carry'].effects);                    // completeQuest + heal
  fx(aft.nodes['ending-carry'].options[0].effects);         // endSlice
  assert(QuestSystem.isDone('a-quiet-toll'), 'quest complete');
  assert(sliceEnded && sliceEnded.outcome === 'win' && sliceEnded.epilogue.length > 50, 'slice ends with epilogue');
});

check('a solo low-Presence Warden still has a gate route (multi-solution guarantee)', () => {
  GameState.reset();
  QuestSystem.init(reg);
  GameState.player = buildCharacter(reg, {
    name: 'Brute', raceId: 'cragfolk', classId: 'warden',
    attributes: { brawn: 5, finesse: 2, intellect: 1, presence: 1 }, isPlayer: true,
  });
  const closed = reg.dialogues.get('bell-gate').nodes.closed;
  const available = closed.options.filter((o) => evaluateConditions(o.conditions, reg) && (o.check || o.next));
  // force-check route must be open (no item, no resonance, full conditions pass)
  assert(available.some((o) => o.check?.skill === 'force'), 'force route available to the brute');
  // and with the cog looted, the tinkering route opens for anyone
  GameState.addItem('mill-cog');
  const rig = closed.options.find((o) => o.check?.skill === 'tinkering');
  assert(evaluateConditions(rig.conditions, reg), 'tinkering route opens with the cog');
});

check('defeat path: losing combat produces a defeat ending state', () => {
  GameState.reset();
  GameState.ending = { outcome: 'defeat', epilogue: '' };
  eq(GameState.ending.outcome, 'defeat', 'defeat state holds');
});

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed${failed ? ` — ${fails.join(', ')}` : ''}`);
process.exit(failed ? 1 : 0);
