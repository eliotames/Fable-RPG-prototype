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
  } else if (req.url().includes('fonts.googleapis.com') || req.url().includes('fonts.gstatic.com')) {
    // UI webfonts are unreachable offline; serve empty CSS so the page falls
    // back to system serif/mono without console noise (BootScene tolerates it)
    req.respond({ status: 200, contentType: 'text/css', body: '/* fonts unavailable offline */' });
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

await step('exploration: top-down map rendered, player placed, movement works', async () => {
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

await step('camera zoom: Z/X step out/in with end clamping, no mid-tween snap', async () => {
  const r = await page.evaluate(async () => {
    const ex = globalThis.game.scene.getScene('Exploration');
    const cam = ex.cameras.main;
    const { zoomTweenMs, zoomDefaultIndex } = globalThis.game.registry.get('content').tuning.exploration;
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    const n = ex.zoomLevels.length;
    for (let i = 0; i < n; i++) { ex.stepZoom(1); await wait(zoomTweenMs + 200); } // n presses: clamps at farthest
    const farthest = cam.zoom;
    // step back in one level, sampling the scroll for single-frame snaps
    const samples = [];
    ex.stepZoom(-1);
    const t0 = Date.now();
    while (Date.now() - t0 < zoomTweenMs + 200) {
      samples.push({ x: cam.scrollX, y: cam.scrollY });
      await wait(16);
    }
    const d = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
    const total = d(samples[0], samples.at(-1));
    let maxStep = 0;
    for (let i = 1; i < samples.length; i++) maxStep = Math.max(maxStep, d(samples[i - 1], samples[i]));
    for (let i = 0; i < n; i++) { ex.stepZoom(-1); await wait(zoomTweenMs + 200); } // clamps at nearest
    const nearest = cam.zoom;
    while (ex.zoomIndex !== zoomDefaultIndex) { // leave the scene at the default level
      ex.stepZoom(ex.zoomIndex < zoomDefaultIndex ? 1 : -1);
      await wait(zoomTweenMs + 200);
    }
    return { farthest, nearest, levels: ex.zoomLevels, total, maxStep, hudZoom: ex.uiCam.zoom };
  });
  if (Math.abs(r.farthest - r.levels.at(-1)) > 1e-3) throw new Error(`farthest ${r.farthest} != ${r.levels.at(-1)}`);
  if (Math.abs(r.nearest - r.levels[0]) > 1e-3) throw new Error(`nearest ${r.nearest} != ${r.levels[0]}`);
  if (r.total > 60 && r.maxStep > r.total * 0.5) {
    throw new Error(`camera snapped: ${r.maxStep.toFixed(0)}px of a ${r.total.toFixed(0)}px pan in one frame`);
  }
  if (r.hudZoom !== 1) throw new Error(`UI camera zoomed: ${r.hudZoom}`);
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

await step('tactical arena: boots from the menu, runs the turn loop to a result', async () => {
  await page.evaluate(() => {
    for (const k of ['MainMenu', 'CharacterCreation', 'Exploration', 'Dialogue', 'Combat', 'End', 'Options']) {
      globalThis.game.scene.stop(k);
    }
    globalThis.game.scene.start('Arena');
  });
  await activeScene('Arena');
  await page.setViewport({ width: 2560, height: 1440 });
  // capture the battlefield once it is a hero's turn (menu visible) for visual review
  await page.waitForFunction(() => {
    const s = globalThis.game.scene.getScene('Arena');
    return s && s.phase === 'menu' && s.actor?.side === 'player';
  }, { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: '/tmp/arena-smoke.png' });

  const r = await page.evaluate(async () => {
    const s = globalThis.game.scene.getScene('Arena');
    // bias toward a quick, deterministic finish (the math itself is unit-tested)
    for (const u of s.units) if (u.side === 'enemy') { u.hp = 12; u.maxHp = 12; }
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    let sawPlayerAttack = false, sawEnemyTurn = false, repositioned = false;
    const start = Date.now();
    while (Date.now() - start < 60000) {
      if (s.phase === 'done' || !globalThis.game.scene.isActive('Arena')) break;
      if (s.phase === 'enemy') sawEnemyTurn = true;
      if (s.phase === 'menu' && s.actor?.side === 'player') {
        if (!s.actor.usedMinor && !repositioned) {
          const mv = s.field.legalMoves(s.actor).find((m) => m.kind === 'move');
          if (mv) { s.enterTargetMove(); s.doMove(mv.lane, mv.slot); repositioned = true; await sleep(40); continue; }
        }
        const targets = s.field.legalTargets(s.actor);
        if (!s.actor.usedMajor && targets.length) { s.commitBasicAttack(targets[0].target); sawPlayerAttack = true; }
        else s.endActorTurn(s.actor);
      }
      await sleep(40);
    }
    return { units: s.units.length, phase: s.phase, ended: s.ended, sawPlayerAttack, sawEnemyTurn, repositioned, log: s.logLines.slice(-2) };
  });
  if (r.units < 6) throw new Error(`expected 6 units, got ${r.units}`);
  if (!r.sawPlayerAttack || !r.sawEnemyTurn) throw new Error(`loop did not exercise both sides: ${JSON.stringify(r)}`);
  if (!r.repositioned) throw new Error('reposition path not exercised');
  if (!r.ended || r.phase !== 'done') throw new Error(`battle did not resolve: ${JSON.stringify(r)}`);
});

await step('no console errors across the whole run', async () => {
  const real = consoleErrors.filter((e) => !e.includes('favicon'));
  if (real.length) throw new Error(real.slice(0, 5).join('\n      '));
});

await browser.close();
server.close();
console.log(failed ? `\n${failed} smoke step(s) FAILED` : '\nbrowser smoke: ALL PASSED');
process.exit(failed ? 1 : 0);
