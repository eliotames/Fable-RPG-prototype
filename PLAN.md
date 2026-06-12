# PLAN — Winds of Silence (vertical slice)

A 2D top-down, text-heavy party RPG vertical slice built on **Phaser 4**, served as a
plain static site (any static file server + a browser). No build step, no bundler, no
dependencies beyond the Phaser global provided by index.html's CDN tag. All content is JSON.

## Guiding principle

**Engine and content never mix.** Engine code (scenes + systems) knows *shapes* of data,
never *instances*. Every race, class, skill, item, ability, enemy, NPC, party member,
quest, dialogue, map, and tuning number lives in `data/` and is registered in
`data/manifest.json`. Adding content = add/edit JSON + one manifest line.

## File layout

```
index.html              entry page (for running as a plain static site)
main.js                 imports the scenes, builds Phaser.Game
scenes/
  BootScene.js          generates placeholder textures, loads manifest.json
  PreloadScene.js       loads every manifest file, validates, builds ContentRegistry
  MainMenuScene.js      title screen
  CharacterCreationScene.js  name → race → class → attribute points → summary
  ExplorationScene.js   top-down tilemap, movement, interactables, HUD, journal
  DialogueScene.js      overlay scene: branching dialogue, passive voices, active checks
  CombatScene.js        turn-based combat: timed hits, parries, weakness/break
  EndScene.js           win / lose / end-of-slice summary
systems/
  GameState.js          run state singleton: player, party, inventory, flags, quests
  ContentRegistry.js    typed access to all loaded content + cross-reference validation
  Validator.js          tiny shape-combinator validator (S.str, S.arr, S.obj, ...)
  shapes.js             expected shape of every content type (one place to extend)
  CharacterFactory.js   race+class+attributes → skills + derived combat stats
  CheckResolver.js      passive reveal + active d20 checks (pure, seedable)
  Script.js             dialogue/interaction conditions + effects interpreter
  CombatMath.js         damage/heal/break/turn-order math (pure, tuning-driven)
  TimingJudge.js        timed-hit / parry grading (pure, tuning-driven)
  QuestSystem.js        stage tracking + journal text
  rng.js                seedable RNG (mulberry32) so tests are deterministic
ui/
  Theme.js              colors, fonts, text styles
  widgets.js            panel / button / bar helpers shared by scenes
data/
  manifest.json         list of every content file: {key, type, path}
  attributes.json  skills.json  races.json  classes.json
  abilities.json   items.json   enemies.json (incl. encounters)
  npcs.json        party.json   quests.json  combat-tuning.json
  dialogue/*.json  (one conversation per file)
  maps/greyreach.json   (Tiled-format orthogonal map JSON)
tests/
  run-tests.mjs         Node test runner: content validation, cross-refs, dialogue
                        graph integrity, combat math, timing windows, factory math,
                        scripted quest-path simulation
README.md  CONTENT_GUIDE.md  PLAN.md
```

## Phaser specifics & decisions

- **Plain ES modules, no globals.** Every file imports exactly what it uses; `main.js`
  imports the eight scenes and constructs the game. Phaser itself is the one global:
  `index.html` loads it from a CDN as a classic script in `<head>`, which is guaranteed
  to execute before the deferred `main.js` module. (`main.js` also exposes `game` and a
  small `WoS` debug handle on `globalThis` for the console and the browser smoke test.)
- **Top-down (oblique) tilemap**: `data/maps/greyreach.json` is Tiled-format JSON
  (`orientation: "orthogonal"`), loaded with `load.tilemapTiledJSON` and rendered with
  Phaser's tilemap API. The tileset texture is generated at Boot (colored squares;
  raised tiles get a darker front face), so there are zero binary assets. Spawns/interactables are a Tiled `objectgroup` whose
  objects carry `tx`/`ty` tile-coordinate custom properties (editor-compatible).
- **Movement**: tile-by-tile (WASD/arrows) with a blocked-tile list defined as a map
  property; flag-gated `barrier` objects (the bell-gate) also block until opened.
- **All interaction is dialogue**: NPCs *and* objects (crates, gates, doors, notice
  boards) open dialogue JSON. One interpreter (`Script.js`) handles every condition and
  effect, so containers, puzzles, recruitment, and combat starts are 100% data.
- **Every tunable number** (attribute→stat derivation, damage coefficients, element
  multipliers, timing windows, break rules, check dice/DCs) lives in `combat-tuning.json`.

## Core schemas (details in CONTENT_GUIDE.md)

- **Dialogue**: `{id, start, nodes: {nodeId: {speaker, text, voices[], options[]}}}`.
  `voices` = passive checks (shown when skill ≥ dc). Options carry `conditions[]`,
  optional active `check {skill, dc, success, failure}`, `effects[]`, `next`.
- **Conditions**: flag/notFlag, skillAtLeast, attributeAtLeast, hasItem, race, class,
  hasPartyMember, hasAbility, questAtStage, questActive.
- **Effects**: setFlag, addItem, removeItem, recruit, startQuest, advanceQuest,
  completeQuest, heal, startCombat (encounter + onWin/onLose dialogue), endSlice, end.
- **Combat**: speed-ordered turns. Abilities: element, power, scaling attribute, focus
  cost, breakPower, target type. Hitting a weakness lowers toughness → at 0, **Break**
  (lose turn, ×damage taken). Timed hit = sweeping cursor, SPACE near center. Parry =
  SPACE within a window after the enemy's "!" flash; perfect negates.

## The slice — "A Quiet Toll" (original world)

The Hush — a creeping silence that deadens sound, speech, and song — has reached the
hamlet of **Greyreach Crossing**. The mill has gone quiet; something roosts inside.

- **Races**: Cragfolk (stone-steady), Skyborn (wind-read), Hollowed (Hush-touched).
- **Classes**: Warden (martial), Windcaller (air magic), Chanter (resonance/support).
- **Attributes**: Brawn, Finesse, Intellect, Presence → 8 skills (Force, Endurance,
  Sleight, Stealth, Lore, Tinkering, Persuasion, Insight).
- **Recruitables**: Maren Vael (Cragfolk Warden, arm-wrestle/persuade her), Issi
  (Hollowed Chanter, gentle Insight-gated approach).
- **Puzzle (3 solutions)**: the bell-gate to the mill — force the winch (Force check),
  rig the pump-hammer with a salvaged cog (item + Tinkering), or sound the bell's note
  (Chanter ability or Issi in party).
- **Combat**: the Husk Sentinel (weak: resonance, resists physical) + 2 Mute Wisps
  (weak: ember/air) — ember flasks let any build exploit a weakness.
- **Quest**: Speak with Elder Senna → open the way → the roost (confrontation dialogue
  with checks that pre-weaken the boss) → combat → aftermath choice → end screen.
- Lose state: party falls in combat → defeat screen → retry from menu.

## Testing strategy

Systems that contain math/logic are ES modules with no Phaser dependency, so Node
imports the same files the browser runs: `node tests/run-tests.mjs`. The suite validates every shipped JSON
file through the same Validator + cross-reference pass the game uses, walks every
dialogue graph for dead ends, exercises combat math edge cases, and simulates the
critical quest path (flags/effects) end to end. A headless-browser smoke test confirms
the game boots to the menu if a browser is available in the environment.
