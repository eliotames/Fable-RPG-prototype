# Winds of Silence — *A Quiet Toll* (vertical slice)

A 2D isometric, text-heavy party RPG built on **Phaser 4**: character creation with
races/classes/attributes, skill-check-driven branching dialogue with internal "voice"
commentary, a reactive explorable map with a multi-solution puzzle, and turn-based party
combat with timed hits, parries, and a weakness/break system.

**Everything that is content lives in JSON under `data/`.** The engine (scenes + systems)
never names a race, NPC, item, or number — add or change content by editing JSON and
registering it in `data/manifest.json`. See `CONTENT_GUIDE.md` for worked examples and
`PLAN.md` for the architecture.

## The story (original setting)

The **Hush** — a creeping stillness that swallows sound, then speech, then breath — has
reached the hamlet of **Greyreach Crossing**. The mill went silent a month ago and
something tall and grey roosts inside it. Take a contract from Elder Senna, recruit help,
open the bell-gate (three different ways), and face what the Hush left in the mill.

## Running it

There is **no build step, no npm install, and no bundler** — the game is plain ES
modules served as a static site. Phaser 4 comes from a CDN `<script>` tag in
`index.html` (swap it for a local copy to run fully offline).

Serve the repo folder with any static file server and open it in a browser:

```
git clone <this repo> && cd winds-of-silence
python3 -m http.server 8000     # or: npx serve, npx http-server, ...
# open http://localhost:8000
```

(A server is required — `file://` URLs can't fetch the JSON content files.)

Layout:

```
index.html            ← entry page (CDN Phaser + <script type="module" src="main.js">)
main.js               ← imports the scenes, builds the Phaser.Game
scenes/   (8 files)   ← Boot, Preload, MainMenu, CharacterCreation,
                        Exploration, Dialogue, Combat, End
systems/  (11 files)  ← validation, content registry, factories, math
ui/       (2 files)   ← theme + shared widgets
data/                 ← ALL content: manifest.json, *.json, dialogue/, maps/
```

On boot, the Preload scene loads every file listed in `data/manifest.json`, validates it
against the expected shape, and cross-checks every reference (abilities classes grant,
nodes dialogues jump to, enemies encounters spawn…). Bad content produces a readable
error screen naming the file and field instead of a broken game.

## Controls

| Context      | Keys |
|--------------|------|
| Exploration  | **WASD / arrows** move · **E / SPACE** interact · **J** journal · **C** party & pack |
| Dialogue     | click an option or press **1–9** |
| Combat       | click actions/targets · **SPACE** for timed hits and parries |
| Menus        | mouse |

## How to play the slice (spoiler-light)

1. **Create a character.** Race + class + 8 attribute points. The right-hand panel shows
   exactly the skills/stats/abilities you'll get — skills gate dialogue and puzzles,
   attributes drive combat.
2. **Talk to Elder Senna** on the village green (S token). High Insight characters will
   notice something she isn't saying.
3. **Recruit help** (optional, recommended): Maren by the quarry road (west), Issi by the
   pond (east). Both can be won several ways; failed checks lead somewhere too.
4. **Open the bell-gate** (north). Three solutions: brute Force on the winch, a salvaged
   cog + Tinkering on the pump-hammer (search Pell's crates), or a resonant voice
   (Chanter player or Issi). Old Tam explains all three if you ask.
5. **Enter the mill.** Your approach at the door (resonance / stealth / loud) can
   pre-crack the boss's guard. Learned hush-lore reveals its weaknesses from round one.
6. **Fight the Husk Sentinel and its wisps.** Press SPACE at the bar's center to boost
   attacks, and at the "!" flash to parry (a perfect parry negates the hit). Hit
   weaknesses (resonance, ember — ember flasks work for any build) to chip Toughness ◆;
   at zero the enemy **Breaks** and loses its turn.
7. **Decide the bell-heart's fate.** Two endings (three if you learned the whole truth).
   Defeat in combat is a proper lose state — return to title and try a new build.

A playthrough takes ~15–25 minutes.

## Tests

Engine logic lives in ES modules with no Phaser dependency, so Node imports the very
same files the browser runs — no tooling:

```
node tests/run-tests.mjs        # or: npm test
```

29 checks: the shipped content passes the game's own validation pipeline, the validator
catches deliberately broken content, dialogue graphs have no unreachable nodes or dead
ends, character/check/combat/timing math matches `combat-tuning.json`, and a scripted
simulation drives the whole critical path (creation → quest → gate → combat hooks →
ending) through the same effect interpreter the game uses.

There is also an optional headless-browser smoke test that serves the repo as a static
site, boots the real game, and plays it through every scene
(`tests/smoke-browser.mjs`); it needs a throwaway directory with
`npm i phaser@4 puppeteer` (test-only deps, never part of the game):

```
mkdir /tmp/smoke && cd /tmp/smoke && npm i phaser@4 puppeteer
cd <repo> && SMOKE_DEPS=/tmp/smoke node tests/smoke-browser.mjs
```

## Extending the game

`CONTENT_GUIDE.md` walks through adding every content type — race, class, skill, item,
ability, enemy, encounter, NPC, dialogue, quest, map — each as "write JSON, add one
manifest line." All combat numbers (damage formula coefficients, timing windows, break
rules, element multipliers, check DCs) live in `data/combat-tuning.json`.
