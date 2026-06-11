/**
 * Browser smoke test — boots the real game in headless Chrome and drives it
 * through every scene: Boot → Preload (validation) → MainMenu → character
 * creation → exploration (map + movement) → dialogue (voices/options) →
 * combat (full loop to victory) → aftermath → End.
 *
 * The repo is served exactly as a static host would serve it; index.html's
 * CDN Phaser request is answered from a local copy so the test runs offline.
 *
 * Requires (test-only, NOT runtime dependencies):
 *   a directory with `npm i phaser@4 puppeteer`, passed via SMOKE_DEPS
 * Usage:
 *   SMOKE_DEPS=/tmp/smoke node tests/smoke-browser.mjs
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const deps = process.env.SMOKE_DEPS ?? '/tmp/smoke';
const require = createRequire(join(deps, 'package.json'));
const puppeteer = require('puppeteer');
const phaserJs = readFileSync(join(deps, 'node_modules/phaser/dist/phaser.min.js'), 'utf8');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
const server = createServer((req, res) => {
  const path = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  if (path === '/favicon.ico') { res.writeHead(204); return res.end(); }
  const file = join(root, path);
  if (!existsSync(file)) { res.writeHead(404); return res.end('nope'); }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

await page.setRequestInterception(true);
page.on('request', (req) => {
  if (req.url().includes('cdn.jsdelivr.net') && req.url().includes('phaser')) {
    req.respond({ status: 200, contentType: 'text/javascript', body: phaserJs });
  } else req.continue();
});

let failed = 0;
const step = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}\n      ${e.message}`);
  }
};
const activeScene = (key) => page.waitForFunction(
  (k) => globalThis.game?.scene?.isActive(k), { timeout: 20000 }, key);

console.log('\n[browser smoke — index.html served as a plain static site]');
await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' });

await step('boots through Boot/Preload to MainMenu (content validated in-engine)', async () => {
  await activeScene('MainMenu');
  const count = await page.evaluate(() => globalThis.game.registry.get('contentFileCount'));
  if (!count || count < 20) throw new Error(`contentFileCount=${count}`);
});

await step('character creation: build a Chanter and confirm', async () => {
  await page.evaluate(() => globalThis.game.scene.getScene('MainMenu').scene.start('CharacterCreation'));
  await activeScene('CharacterCreation');
  await page.evaluate(() => {
    const cc = globalThis.game.scene.getScene('CharacterCreation');
    cc.name = 'Smoke';
    cc.raceId = 'hollowed';
    cc.classId = 'chanter';
    cc.dist = { brawn: 3, finesse: 2, intellect: 3, presence: 4 }; // spends the 8-point pool
    cc.redrawAll();
    cc.confirm();
  });
  await activeScene('Exploration');
});

await step('exploration: iso map rendered, player placed, movement works', async () => {
  const r = await page.evaluate(async () => {
    const ex = globalThis.game.scene.getScene('Exploration');
    const before = { tx: ex.ptx, ty: ex.pty, x: ex.playerToken.x, y: ex.playerToken.y };
    ex.keys.W.isDown = true;
    await new Promise((res) => setTimeout(res, 600));
    ex.keys.W.isDown = false;
    return {
      layer: !!ex.layer, tiles: ex.map.width * ex.map.height,
      interactables: ex.interactables.length, before, after: { tx: ex.ptx, ty: ex.pty },
    };
  });
  if (!r.layer || r.tiles !== 18 * 14) throw new Error(`map wrong: ${JSON.stringify(r)}`);
  if (r.interactables !== 11) throw new Error(`expected 11 interactables, got ${r.interactables}`);
  if (r.after.ty >= r.before.ty) throw new Error('player did not move north');
});

await step('dialogue: Senna opens with text, voices, and options', async () => {
  await page.evaluate(() => globalThis.game.scene.getScene('Exploration').openDialogue('elder-senna'));
  await activeScene('Dialogue');
  const r = await page.evaluate(() => {
    const d = globalThis.game.scene.getScene('Dialogue');
    const texts = d.nodeObjects.map((o) => o.text ?? '').join('\n');
    return { texts, count: d.nodeObjects.length };
  });
  if (!r.texts.includes('ELDER SENNA')) throw new Error('speaker missing');
  if (!r.texts.includes('Insight')) throw new Error('passive Insight voice missing (presence-built char)');
  if (!r.texts.toLowerCase().includes('passing through')) throw new Error('options missing');
});

await step('dialogue effects: quest start + recruitment through real option flow', async () => {
  await page.evaluate(() => {
    const d = globalThis.game.scene.getScene('Dialogue');
    d.enterNode('task'); // Senna's quest-grant node
    d.choose(d.dialogue.nodes.task.options[0]); // closes dialogue via end effect
  });
  await activeScene('Exploration');
  const r = await page.evaluate(() => {
    const { GameState, QuestSystem, Script } = globalThis.WoS;
    const ex = globalThis.game.scene.getScene('Exploration');
    const reg = globalThis.game.registry.get('content');
    // recruit both companions through Script effects (as their dialogues would)
    Script.applyEffects(reg.dialogues.get('maren-vael').nodes['wrestle-win'].effects, reg, {});
    Script.applyEffects(reg.dialogues.get('issi').nodes.patience.effects, reg, {});
    ex.refreshWorldState();
    return {
      quest: QuestSystem.isAtStage('a-quiet-toll', 'open-the-way'),
      party: GameState.party.map((m) => m.name),
      marenHidden: ex.interactables.find((i) => i.ref === 'maren').hidden,
    };
  });
  if (!r.quest) throw new Error('quest not at open-the-way');
  if (r.party.length !== 2) throw new Error(`party: ${r.party}`);
  if (!r.marenHidden) throw new Error('recruited NPC still on map');
});

await step('combat: full loop — timed hits, break, enemy turns, victory', async () => {
  await page.evaluate(() => {
    const { GameState } = globalThis.WoS;
    GameState.setFlag('gate-open');
    GameState.setFlag('sentinel-weakened');
    GameState.setFlag('hush-lore');
    const reg = globalThis.game.registry.get('content');
    // speed the fight up for the smoke test (combat math itself is unit-tested)
    reg.tuning.timing.parry.telegraphMinMs = 80;
    reg.tuning.timing.parry.telegraphMaxMs = 120;
    reg.tuning.timing.parry.windowMs = 80;
    reg.tuning.timing.attack.sweepMs = 200;
    globalThis.game.scene.getScene('Exploration').scene.stop('Exploration');
    globalThis.game.scene.start('Combat', { encounterId: 'mill-roost', onWin: 'sentinel-aftermath' });
  });
  await activeScene('Combat');
  const result = await page.evaluate(async () => {
    const cs = globalThis.game.scene.getScene('Combat');
    const reg = globalThis.game.registry.get('content');
    let sawBreak = false, sawEnemyTurn = false, actions = 0;
    const start = Date.now();
    while (Date.now() - start < 60000) {
      if (!globalThis.game.scene.isActive('Combat')) break; // victory handed off
      if (cs.phase === 'menu' && cs.actor) {
        actions++;
        const resonant = cs.actor.abilities.find((a) => reg.abilities.get(a).element === 'resonance' && cs.actor.focus >= reg.abilities.get(a).focusCost);
        const ember = Object.keys(globalThis.WoS.GameState.inventory).find((id) => reg.items.get(id)?.combat?.element === 'ember');
        if (resonant) cs.pickAbility(cs.actor, reg.abilities.get(resonant));
        else if (ember) cs.pickItem(cs.actor, reg.items.get(ember));
        else cs.pickAbility(cs.actor, reg.abilities.get(cs.actor.abilities[0]));
        if (cs.phase === 'target') {
          const target = cs.targetSide === 'enemy' ? cs.livingEnemies()[0] : cs.livingParty()[0];
          cs.commitTarget(target);
        }
      }
      if (cs.phase === 'timing' && cs.spaceHandler) cs.spaceHandler(); // press SPACE
      if (cs.phase === 'enemy') sawEnemyTurn = true;
      if (cs.enemies?.some((e) => e.broken)) sawBreak = true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return { sawBreak, sawEnemyTurn, actions, log: cs.logLines.slice(-3) };
  });
  if (!result.sawEnemyTurn) throw new Error('no enemy turn observed');
  if (!result.sawBreak) throw new Error('no BREAK observed despite resonance/ember spam');
  await activeScene('Dialogue'); // aftermath auto-launched via Exploration
  const aft = await page.evaluate(() => globalThis.game.scene.getScene('Dialogue').dialogue.id);
  if (aft !== 'sentinel-aftermath') throw new Error(`wrong dialogue: ${aft}`);
});

await step('ending: aftermath choice reaches the End scene with a win', async () => {
  await page.evaluate(() => {
    const d = globalThis.game.scene.getScene('Dialogue');
    d.enterNode('ending-shatter');
    d.choose(d.dialogue.nodes['ending-shatter'].options[0]);
  });
  await activeScene('End');
  const r = await page.evaluate(() => {
    const { GameState, QuestSystem } = globalThis.WoS;
    return { outcome: GameState.ending?.outcome, done: QuestSystem.isDone('a-quiet-toll') };
  });
  if (r.outcome !== 'win' || !r.done) throw new Error(JSON.stringify(r));
});

await step('no console errors across the whole run', async () => {
  const real = consoleErrors.filter((e) => !e.includes('favicon'));
  if (real.length) throw new Error(real.slice(0, 5).join('\n      '));
});

await browser.close();
server.close();
console.log(failed ? `\n${failed} smoke step(s) FAILED` : '\nbrowser smoke: ALL PASSED');
process.exit(failed ? 1 : 0);
