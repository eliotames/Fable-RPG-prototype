# CLAUDE.md — read this first, then only what the task needs

**Winds of Silence** is a Phaser 4 RPG vertical slice served as a plain static site:
no build step, no npm install, no dependencies (Phaser comes from a CDN `<script>` in
`index.html`). Plain ES modules throughout. The one architecture rule: **engine and
content never mix** — engine code (`main.js`, `scenes/`, `systems/`, `ui/`) knows the
*shapes* of data, never instances; all content is JSON under `data/`, registered in
`data/manifest.json` and validated at boot against `systems/shapes.js`. Architecture
details: `PLAN.md`. Authoring content: `CONTENT_GUIDE.md`.

## Context discipline (hard rule)

Do **NOT** read files under `data/` except `data/manifest.json` and
`data/combat-tuning.json`. The rest is bulky story text; its schemas are fully
described in `systems/shapes.js` and `CONTENT_GUIDE.md`. Read other `data/` files
only if the user explicitly asks about story content.

## Reading map — open only the files for your change type

- **Combat rules** (damage, break, turn order, timed hits/parries):
  `systems/CombatMath.js`, `systems/TimingJudge.js`, `scenes/CombatScene.js`,
  `data/combat-tuning.json`
- **Skill checks / dialogue mechanics** (voices, active checks, option gating):
  `systems/CheckResolver.js`, `scenes/DialogueScene.js`, `systems/Script.js`,
  `checks` block of `data/combat-tuning.json`
- **Character creation / stat derivation**:
  `systems/CharacterFactory.js`, `scenes/CharacterCreationScene.js`,
  `creation`/`derivation` blocks of `data/combat-tuning.json`
- **Exploration / map behavior** (movement, interactables, barriers, HUD, journal):
  `scenes/ExplorationScene.js`, `checkMap`/`propsOf` in `systems/ContentRegistry.js`,
  `map` shape in `systems/shapes.js`, `scenes/BootScene.js` (generated textures/tileset)
- **UI look and feel**: `ui/Theme.js`, `ui/widgets.js`, plus the scene being styled
- **New content TYPE** (new schema + registry + loaders):
  `systems/shapes.js`, `systems/ContentRegistry.js` (`ingest` + `finalize`),
  `scenes/PreloadScene.js`, `data/manifest.json`, `tests/run-tests.mjs`;
  document it in `CONTENT_GUIDE.md`
- **New condition or effect type** (Script interpreter):
  `systems/Script.js` (interpreter), `systems/ContentRegistry.js`
  (`checkCondition`/`checkEffect` cross-ref), condition/effect shapes at the top of
  `systems/shapes.js`; list it in `CONTENT_GUIDE.md`'s reference tables
- **Balance tuning** (numbers only): `data/combat-tuning.json` alone — every
  coefficient, DC, timing window, and multiplier lives there; consumers are
  `CombatMath`/`TimingJudge`/`CharacterFactory`/`CheckResolver`
- **Quest/flag flow**: `systems/QuestSystem.js`, `systems/GameState.js`,
  `systems/Script.js`
- **Boot/validation pipeline**: `scenes/BootScene.js` → `scenes/PreloadScene.js` →
  `systems/Validator.js` → `systems/shapes.js` → `systems/ContentRegistry.js`

## Verifying changes

- `node tests/run-tests.mjs` (or `npm test`) — 29 checks, zero deps; must pass.
  Tests import the same ES modules the browser runs. They do **not** execute any
  Phaser rendering — a change can pass all 29 and still crash a scene at runtime.
- Headless-browser smoke test: `tests/smoke-browser.mjs` boots the real game and
  plays through every scene. Run it for **any change touching scenes/, ui/, or
  rendering-related data**. In Claude Code cloud sessions the npm registry is
  reachable (CDN hosts are not), so set it up with:
  `mkdir -p /tmp/smoke && cd /tmp/smoke && npm init -y && npm i phaser@4 puppeteer`
  then `SMOKE_DEPS=/tmp/smoke node tests/smoke-browser.mjs`. Note it drives scene
  methods programmatically — real pointer clicks are not covered. Screenshots via
  puppeteer (viewport 2560×1440) are the way to verify layout visually.
- Run the game: any static server + browser, e.g. `python3 -m http.server 8000`
  (a server is required; `file://` can't fetch the JSON). The server sends no
  Cache-Control headers, so browsers cache aggressively — hard-reload
  (Ctrl+Shift+R) or DevTools "Disable cache" after changes.

## Resolution & rendering facts

- The game renders natively at **2560×1440**; all scene/UI coordinates and font
  sizes are authored in that space (`Scale.FIT` letterboxes other window sizes).
- BootScene generates the iso tileset at **128×64 per tile**. The map JSON's
  embedded tileset (`tilewidth`, `tileheight`, `imagewidth`, `imageheight`) must
  match the generated texture exactly — Phaser builds the tileset's UV table from
  those declared numbers, and a mismatch crashes ExplorationScene.create with an
  opaque TypeError (the game appears to freeze when leaving character creation).
- Low FPS (~20) that's identical idle vs. moving means the browser is
  software-rendering WebGL, not that the game is heavy — check `chrome://gpu`
  for "Hardware accelerated" before touching game code. The scene workload
  itself holds 60fps even under CPU rendering on a fast machine.

## Conventions to preserve

- ES modules with explicit imports; no globals. Exceptions: the `Phaser` global from
  `index.html`'s CDN tag, and the deliberate `globalThis.game` / `globalThis.WoS`
  debug handles in `main.js`.
- Every tunable number lives in `data/combat-tuning.json` — never hardcode one.
- New content fields must be added to `systems/shapes.js` so boot validation stays
  exhaustive; new cross-file references get a check in `ContentRegistry.finalize`.
- Engine code must never name a specific race/NPC/item/quest — if you're typing a
  content id into `scenes/` or `systems/`, it belongs in JSON instead.
