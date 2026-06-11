# Content Guide — modding Winds of Silence with JSON only

Every piece of game content lives under `data/` and is listed in `data/manifest.json`.
Adding anything means: **(1) write/edit a JSON file, (2) add one line to the manifest.**
You never touch `scenes/` or `systems/`.

On boot the game validates everything. If you make a mistake — a typo'd field, a
reference to a skill that doesn't exist, a dialogue option pointing at a missing node —
the game shows a readable error like:

```
data/races.json → $.races[1]: missing required field "skillBonuses" (dictionary)
dialogue/my-npc.nodes.intro.options[0]: next → unknown node "wat"
```

Run `node tests/run-tests.mjs` for the same validation from the command line, plus
graph and math checks.

**Comments:** any key named `"//"` is ignored everywhere, so annotate freely.

---

## The manifest

```json
{ "files": [
  { "key": "races",        "type": "races",    "path": "data/races.json" },
  { "key": "dlg-my-npc",   "type": "dialogue", "path": "data/dialogue/my-npc.json" },
  { "key": "map-greyreach","type": "map",      "path": "data/maps/greyreach.json" }
] }
```

- `key` — unique cache id (any string).
- `type` — how the engine validates/indexes the file: `attributes` `skills` `races`
  `classes` `abilities` `items` `enemies` `npcs` `party` `quests` `tuning` `dialogue` `map`.
- `path` — loaded by the Phaser loader at runtime.

Collection types (`races`, `items`, …) may be split across **multiple files** of the same
type — ids just have to stay globally unique. Each `dialogue` file holds one conversation;
each `map` file one map.

---

## 1. Add a race

`data/races.json` → append to `races`:

```json
{
  "id": "ferrous",
  "name": "Ferrous",
  "desc": "Foundry-born folk with iron in the blood and patience in the bone.",
  "attributeBonuses": { "brawn": 1 },
  "skillBonuses": { "tinkering": 1, "endurance": 1 }
}
```

Done — it appears in character creation, and `{"type":"race","race":"ferrous"}` becomes
usable as a dialogue condition. Optional: `"abilities": ["some-ability-id"]` for a racial
ability. Bonuses are added **on top of** the player's distributed points.

## 2. Add a class

`data/classes.json` → append to `classes`:

```json
{
  "id": "lampwright",
  "name": "Lampwright",
  "desc": "Keeper of the hearth-lines. Carries fire like an argument.",
  "attributeBonuses": { "finesse": 1 },
  "skillBonuses": { "sleight": 1, "lore": 1 },
  "armor": 2,
  "abilities": ["strike", "ember-lash"],
  "startingItems": [ { "item": "ember-flask", "qty": 2 } ]
}
```

`armor` adds to derived defense. `abilities` and `startingItems` must reference existing
ids (validation will tell you if they don't).

## 3. Add a skill (or attribute)

`data/skills.json`:

```json
{
  "id": "survival",
  "name": "Survival",
  "attribute": "brawn",
  "desc": "Read weather, track game, sleep dry.",
  "voiceColor": "#9ab87a"
}
```

A skill's value = its governing attribute + race/class bonuses. It is *immediately*
usable in dialogue: passive voices (`"voices": [{"skill":"survival", ...}]`), gates
(`skillAtLeast`), and active checks (`"check": {"skill":"survival", ...}`).
Attributes work the same way in `data/attributes.json`; `combat-tuning.json → derivation`
decides how attributes become HP/Focus/Defense/Speed.

## 4. Add an ability

`data/abilities.json`:

```json
{
  "id": "ember-lash",
  "name": "Ember Lash",
  "desc": "A whip-crack of lamp-fire.",
  "kind": "damage",
  "element": "ember",
  "power": 12,
  "scaling": "finesse",
  "focusCost": 2,
  "target": "enemy",
  "breakPower": 2,
  "timed": true
}
```

- `kind`: `damage` or `heal`. `target`: `enemy` / `ally` / `self`.
- `element` must be in `combat-tuning.json → elements.list`.
- `scaling`: the attribute fed into the damage formula (enemies use their `attack` stat).
- `breakPower`: Toughness chipped when this hits a weakness.
- `timed`: shows the timed-hit bar. For **enemy** abilities, add a `"telegraph"` string —
  the wind-up text shown before the parry flash.

Grant it via a class/race `abilities` list (players/party) or an enemy's `abilities`.

## 5. Add an item

`data/items.json`:

```json
{
  "id": "frost-philter",
  "name": "Frost Philter",
  "desc": "Cold enough to make silence shiver.",
  "type": "consumable",
  "combat": { "kind": "damage", "power": 11, "element": "air", "breakPower": 1,
              "target": "enemy", "timed": true }
}
```

`type`: `consumable` (usable in combat if it has a `combat` block), `key` (puzzle objects
checked with `hasItem`), or `trinket` (flavor). Hand items out with the `addItem`
dialogue effect or class `startingItems`.

## 6. Add an enemy and an encounter

`data/enemies.json`:

```json
{
  "id": "wax-tongue",
  "name": "Wax-Tongue",
  "desc": "A crawling daub of hush-wax looking for a bell to gag.",
  "maxHp": 26, "attack": 4, "defense": 2, "speed": 5, "toughness": 3,
  "weaknesses": ["ember"], "resists": ["air"],
  "abilities": ["wisp-drain"],
  "ai": { "targeting": "weakest",
          "moves": [ { "ability": "wisp-drain", "weight": 1 } ] }
}
```

`ai.targeting`: `random` / `weakest` / `strongest`. Then make it fightable with an
encounter in the same file:

```json
{
  "id": "wax-nest",
  "name": "The Wax Nest",
  "intro": "Something glistens in the cellar dark…",
  "enemies": ["wax-tongue", "wax-tongue"],
  "modifiers": [
    { "flag": "scouted-nest", "enemy": "wax-tongue", "revealWeaknesses": true },
    { "flag": "nest-burned",  "enemy": "wax-tongue", "toughnessDelta": -1 }
  ]
}
```

`modifiers` make story flags change the fight (pre-weaken, scout). Start it from any
dialogue option: `{"type":"startCombat","encounter":"wax-nest","onWin":"some-dialogue"}`.

## 7. Add an NPC with a dialogue

Three steps:

**a)** `data/npcs.json`:

```json
{ "id": "brindle", "name": "Brindle", "dialogue": "brindle",
  "glyph": "B", "color": "#d8a0a0", "desc": "A shepherd without a flock." }
```

**b)** `data/dialogue/brindle.json` (and one manifest line:
`{"key":"dlg-brindle","type":"dialogue","path":"data/dialogue/brindle.json"}`):

```json
{
  "id": "brindle",
  "start": "entry",
  "nodes": {
    "entry": {
      "text": "(routing)",
      "redirects": [
        { "conditions": [{ "type": "flag", "flag": "met-brindle" }], "node": "again" },
        { "node": "intro" }
      ]
    },
    "intro": {
      "speaker": "Brindle",
      "text": "\"Sheep gone quiet three valleys over. Then gone, full stop.\"",
      "effects": [ { "type": "setFlag", "flag": "met-brindle" } ],
      "voices": [
        { "skill": "insight", "dc": 4, "text": "He counts on his fingers while he talks — still tallying a flock that isn't there." }
      ],
      "options": [
        { "text": "\"Where did you last hear them?\"", "next": "where" },
        {
          "text": "[lie] \"I've seen your flock. Safe, past the ford.\"",
          "check": { "skill": "persuasion", "dc": "hard", "success": "lie-ok", "failure": "lie-bad" }
        },
        { "text": "Leave him to his counting.", "effects": [ { "type": "end" } ] }
      ]
    },
    "where":   { "speaker": "Brindle", "text": "…", "options": [ { "text": "Go.", "effects": [ { "type": "end" } ] } ] },
    "lie-ok":  { "speaker": "Brindle", "text": "…", "options": [ { "text": "Go.", "effects": [ { "type": "end" } ] } ] },
    "lie-bad": { "speaker": "Brindle", "text": "…", "options": [ { "text": "Go.", "effects": [ { "type": "end" } ] } ] },
    "again":   { "speaker": "Brindle", "text": "\"Still counting.\"", "options": [ { "text": "Nod.", "effects": [ { "type": "end" } ] } ] }
  }
}
```

**c)** Place him on the map (see §10) with an object: `kind=npc`, `ref=brindle`, `tx`, `ty`.

### Dialogue node anatomy

| Field | Meaning |
|---|---|
| `speaker` | name shown above the text (omit for narration/objects) |
| `text` | body prose (`\n\n` for paragraphs) |
| `voices` | **passive checks**: shown if the player's skill ≥ `dc` (no roll) — internal skill commentary |
| `redirects` | evaluated on entry, first match wins — route by game state |
| `effects` | run on node entry |
| `options` | player choices; each may have `conditions`, `effects`, and `next` **or** `check` |
| `next` | node for option-less "continue" nodes |

An option with a `check` rolls `1d20 + skill` vs the DC (number, or a name from
`combat-tuning.json → checks.difficulties`) and routes to `success`/`failure` — make both
interesting. A node with no options and no `next` shows "(Leave)" and closes.

### Conditions reference

```
{"type":"flag","flag":"x"}            {"type":"notFlag","flag":"x"}
{"type":"skillAtLeast","skill":"lore","value":4}
{"type":"attributeAtLeast","attribute":"brawn","value":4}
{"type":"hasItem","item":"mill-cog"}  {"type":"race","race":"hollowed"}
{"type":"class","class":"chanter"}    {"type":"hasPartyMember","member":"issi"}
{"type":"hasAbility","ability":"resonant-word"}        ← anyone in the party
{"type":"questAtStage","quest":"q","stage":"s"}
{"type":"questActive","quest":"q"}    {"type":"questDone","quest":"q"}
```

All conditions on an option/redirect must pass (AND). For OR, write two options.

### Effects reference

```
{"type":"setFlag","flag":"x"}                       {"type":"addItem","item":"i","qty":2}
{"type":"removeItem","item":"i"}                    {"type":"recruit","member":"maren"}
{"type":"startQuest","quest":"q"}                   {"type":"advanceQuest","quest":"q","stage":"s"}
{"type":"completeQuest","quest":"q"}                {"type":"healParty","fraction":1}
{"type":"startCombat","encounter":"e","onWin":"dialogue-id"}
{"type":"endSlice","outcome":"win","epilogue":"…"}  {"type":"end"}
```

Put `startCombat`/`endSlice` on an **option**, not on node-entry effects, so the player
gets to read the node first.

## 8. Add a recruitable party member

`data/party.json` — built through the same factory as the player:

```json
{ "id": "brindle", "name": "Brindle", "race": "cragfolk", "class": "warden",
  "attributes": { "brawn": 4, "finesse": 3, "intellect": 2, "presence": 3 },
  "bio": "A shepherd who has decided wolves were good practice." }
```

Recruit with `{"type":"recruit","member":"brindle"}` from any dialogue. If an NPC token
shares the member's id, it disappears from the map once recruited (or use a `hideFlag`
object property).

## 9. Add a quest

`data/quests.json`:

```json
{ "id": "lost-flock", "name": "The Lost Flock",
  "stages": [
    { "id": "find-trail",  "journal": "Brindle's flock went silent…", "hint": "Search the west valleys." },
    { "id": "the-shearer", "journal": "Something has been shearing…", "hint": "Confront the shearer." }
  ] }
```

Drive it entirely from dialogue effects: `startQuest` (enters at the first stage),
`advanceQuest` (jump to any stage — it auto-starts if needed, so sequence-breaking
players are safe), `completeQuest`. The HUD shows the current `hint`; the journal (J)
shows `journal`.

## 10. Add or edit a map

Maps are **Tiled-format isometric JSON** (`data/maps/*.json`, manifest type `map`) —
editable by hand or in the Tiled map editor (orientation `isometric`,
tile size 64×32). The engine reads:

- the first tile layer (terrain; tile gids 1–8 from the generated tileset: 1 grass,
  2 path, 3 water, 4 stone, 5 rock wall, 6 hush, 7 field, 8 bridge),
- map properties: `displayName` (HUD) and `blockedTiles` (csv of impassable gids),
- one object layer where **every object carries custom properties**:

| `kind` | extra properties | behavior |
|---|---|---|
| `spawn` | `tx`, `ty` | player start |
| `npc` | `ref` (npcs.json id), `tx`, `ty` | token + name, E opens the NPC's dialogue |
| `object` | `dialogue`, `label`, `glyph`, `color`, `tx`, `ty` | interactable: crates, doors, signs, anything |
| `barrier` | `flag`, `dialogue`, `tx`, `ty` | blocks movement until `flag` is set; E opens its dialogue (puzzles) |

Optional on any object: `hideFlag` (token hidden once the flag is set). Containers are
just `object`s whose dialogue grants `addItem` once (gate with `notFlag`). Multi-tile
barriers = several barrier objects sharing one `flag`.

To add a second map: write the file, register it
(`{"key":"map-cellar","type":"map","path":"data/maps/cellar.json"}`). The slice's
Exploration scene loads the first registered map by default; a door that travels between
maps is the engine's next planned feature (see PLAN.md).

## 11. Tune the combat (and checks)

Everything numeric lives in `data/combat-tuning.json`, commented inline: attribute→stat
derivation, the damage formula's coefficients, element weakness/resist multipliers,
timed-hit sweep/windows/multipliers, parry telegraph/window, Break rules (chip, bonus
damage, lost turns, recovery), focus regen, defend, check die + named difficulties
(`"dc": "hard"` in any dialogue resolves through this file), the party-wide Lore
threshold that auto-reveals weaknesses, and party size.

Change a number, reload, done. If you rename or remove a field the validator will tell
you exactly what broke.
