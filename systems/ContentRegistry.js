/**
 * ContentRegistry — typed access to every loaded content file, plus
 * cross-reference validation (e.g. "this class grants an ability that doesn't
 * exist"). PreloadScene feeds it JSON from the Phaser cache; the Node test
 * suite feeds it JSON from disk.
 */
import { validate } from './Validator.js';
import { shapes, KNOWN_TYPES } from './shapes.js';

export class ContentError extends Error {
  /** @param {string[]} problems */
  constructor(problems) {
    super(`Content validation failed:\n${problems.join('\n')}`);
    this.problems = problems;
  }
}

export class ContentRegistry {
  constructor() {
    /** @type {Map<string,object>} */ this.attributes = new Map();
    /** @type {Map<string,object>} */ this.skills = new Map();
    /** @type {Map<string,object>} */ this.races = new Map();
    /** @type {Map<string,object>} */ this.classes = new Map();
    /** @type {Map<string,object>} */ this.abilities = new Map();
    /** @type {Map<string,object>} */ this.items = new Map();
    /** @type {Map<string,object>} */ this.enemies = new Map();
    /** @type {Map<string,object>} */ this.encounters = new Map();
    /** @type {Map<string,object>} */ this.npcs = new Map();
    /** @type {Map<string,object>} */ this.partyMembers = new Map();
    /** @type {Map<string,object>} */ this.quests = new Map();
    /** @type {Map<string,object>} */ this.dialogues = new Map();
    /** @type {Map<string,object>} Raw map JSON by manifest key */ this.maps = new Map();
    /** @type {object|null} */ this.tuning = null;
    /** @type {string[]} */ this.problems = [];
  }

  /**
   * Validate one file against its shape and index its contents.
   * @param {string} type manifest type  @param {string} key manifest key
   * @param {object} json parsed file contents  @param {string} path for error messages
   */
  ingest(type, key, json, path) {
    if (!KNOWN_TYPES.includes(type)) {
      this.problems.push(`${path}: unknown manifest type "${type}" (known: ${KNOWN_TYPES.join(', ')})`);
      return;
    }
    const errors = validate(json, shapes[type], path);
    if (errors.length) {
      this.problems.push(...errors);
      return;
    }
    const indexInto = (map, list, what) => {
      for (const entry of list) {
        if (map.has(entry.id)) this.problems.push(`${path}: duplicate ${what} id "${entry.id}"`);
        map.set(entry.id, entry);
      }
    };
    switch (type) {
      case 'attributes': indexInto(this.attributes, json.attributes, 'attribute'); break;
      case 'skills': indexInto(this.skills, json.skills, 'skill'); break;
      case 'races': indexInto(this.races, json.races, 'race'); break;
      case 'classes': indexInto(this.classes, json.classes, 'class'); break;
      case 'abilities': indexInto(this.abilities, json.abilities, 'ability'); break;
      case 'items': indexInto(this.items, json.items, 'item'); break;
      case 'enemies':
        indexInto(this.enemies, json.enemies, 'enemy');
        indexInto(this.encounters, json.encounters, 'encounter');
        break;
      case 'npcs': indexInto(this.npcs, json.npcs, 'npc'); break;
      case 'party': indexInto(this.partyMembers, json.partyMembers, 'party member'); break;
      case 'quests': indexInto(this.quests, json.quests, 'quest'); break;
      case 'dialogue':
        if (this.dialogues.has(json.id)) this.problems.push(`${path}: duplicate dialogue id "${json.id}"`);
        this.dialogues.set(json.id, json);
        break;
      case 'map': this.maps.set(key, json); break;
      case 'tuning': this.tuning = json; break;
    }
  }

  /**
   * Check every reference between content files. Call once after all ingests.
   * Throws ContentError listing every problem found (shape + cross-ref).
   */
  finalize() {
    const p = this.problems;
    if (!this.tuning) p.push('manifest: no file of type "tuning" was registered (combat-tuning.json)');
    if (this.tuning) {
      const elements = this.tuning.elements.list;
      for (const [id, d] of Object.entries(this.tuning.derivation)) {
        if (d.attribute && !this.attributes.has(d.attribute)) p.push(`combat-tuning derivation.${id}: unknown attribute "${d.attribute}"`);
      }
      for (const [id, a] of this.abilities) {
        if (a.kind === 'damage' && !elements.includes(a.element)) p.push(`abilities.${id}: element "${a.element}" not in combat-tuning elements.list`);
        if (!this.attributes.has(a.scaling)) p.push(`abilities.${id}: scaling attribute "${a.scaling}" does not exist`);
      }
      for (const [id, e] of this.enemies) {
        for (const w of e.weaknesses) if (!elements.includes(w)) p.push(`enemies.${id}: weakness "${w}" not in elements.list`);
        for (const r of e.resists) if (!elements.includes(r)) p.push(`enemies.${id}: resist "${r}" not in elements.list`);
      }
    }
    for (const [id, s] of this.skills) {
      if (!this.attributes.has(s.attribute)) p.push(`skills.${id}: governing attribute "${s.attribute}" does not exist`);
    }
    const checkBonusKeys = (owner, bonuses, map, what) => {
      for (const key of Object.keys(bonuses)) {
        if (key !== '//' && !map.has(key)) p.push(`${owner}: ${what} bonus targets unknown id "${key}"`);
      }
    };
    for (const [id, r] of this.races) {
      checkBonusKeys(`races.${id}`, r.attributeBonuses, this.attributes, 'attribute');
      checkBonusKeys(`races.${id}`, r.skillBonuses, this.skills, 'skill');
      for (const ab of r.abilities ?? []) if (!this.abilities.has(ab)) p.push(`races.${id}: unknown ability "${ab}"`);
    }
    for (const [id, c] of this.classes) {
      checkBonusKeys(`classes.${id}`, c.attributeBonuses, this.attributes, 'attribute');
      checkBonusKeys(`classes.${id}`, c.skillBonuses, this.skills, 'skill');
      for (const ab of c.abilities) if (!this.abilities.has(ab)) p.push(`classes.${id}: unknown ability "${ab}"`);
      for (const si of c.startingItems ?? []) if (!this.items.has(si.item)) p.push(`classes.${id}: unknown starting item "${si.item}"`);
    }
    for (const [id, e] of this.enemies) {
      for (const ab of e.abilities) if (!this.abilities.has(ab)) p.push(`enemies.${id}: unknown ability "${ab}"`);
      for (const m of e.ai.moves) if (!e.abilities.includes(m.ability)) p.push(`enemies.${id}: ai move "${m.ability}" not in this enemy's abilities list`);
    }
    for (const [id, enc] of this.encounters) {
      for (const en of enc.enemies) if (!this.enemies.has(en)) p.push(`encounters.${id}: unknown enemy "${en}"`);
      for (const mod of enc.modifiers ?? []) {
        if (!this.enemies.has(mod.enemy)) p.push(`encounters.${id}: modifier targets unknown enemy "${mod.enemy}"`);
      }
    }
    for (const [id, n] of this.npcs) {
      if (!this.dialogues.has(n.dialogue)) p.push(`npcs.${id}: dialogue "${n.dialogue}" was not loaded (check manifest)`);
    }
    for (const [id, m] of this.partyMembers) {
      if (!this.races.has(m.race)) p.push(`party.${id}: unknown race "${m.race}"`);
      if (!this.classes.has(m.class)) p.push(`party.${id}: unknown class "${m.class}"`);
      checkBonusKeys(`party.${id}`, m.attributes, this.attributes, 'attribute');
    }
    for (const [qid, q] of this.quests) {
      const seen = new Set();
      for (const st of q.stages) {
        if (seen.has(st.id)) p.push(`quests.${qid}: duplicate stage id "${st.id}"`);
        seen.add(st.id);
      }
    }
    for (const [did, d] of this.dialogues) this.checkDialogue(did, d, p);
    for (const [key, m] of this.maps) this.checkMap(key, m, p);

    if (p.length) throw new ContentError(p);
  }

  /** Verify a dialogue graph: node targets, condition/effect references. */
  checkDialogue(did, d, p) {
    const where = `dialogue/${did}`;
    const nodeExists = (n) => n in d.nodes;
    if (!nodeExists(d.start)) p.push(`${where}: start node "${d.start}" does not exist`);
    for (const [nid, node] of Object.entries(d.nodes)) {
      if (nid === '//') continue;
      const at = `${where}.nodes.${nid}`;
      if (node.next && !nodeExists(node.next)) p.push(`${at}: next → unknown node "${node.next}"`);
      (node.redirects ?? []).forEach((r, i) => {
        if (!nodeExists(r.node)) p.push(`${at}.redirects[${i}]: → unknown node "${r.node}"`);
        for (const c of r.conditions ?? []) this.checkCondition(`${at}.redirects[${i}]`, c, p);
      });
      for (const v of node.voices ?? []) {
        if (!this.skills.has(v.skill)) p.push(`${at}: voice references unknown skill "${v.skill}"`);
      }
      for (const e of node.effects ?? []) this.checkEffect(`${at}`, e, p);
      (node.options ?? []).forEach((opt, i) => {
        const oat = `${at}.options[${i}]`;
        if (opt.next && !nodeExists(opt.next)) p.push(`${oat}: next → unknown node "${opt.next}"`);
        if (opt.check) {
          if (!this.skills.has(opt.check.skill)) p.push(`${oat}: check uses unknown skill "${opt.check.skill}"`);
          if (!nodeExists(opt.check.success)) p.push(`${oat}: check success → unknown node "${opt.check.success}"`);
          if (!nodeExists(opt.check.failure)) p.push(`${oat}: check failure → unknown node "${opt.check.failure}"`);
          const dc = opt.check.dc;
          const named = this.tuning?.checks?.difficulties ?? {};
          if (typeof dc !== 'number' && !(dc in named)) p.push(`${oat}: dc "${dc}" is neither a number nor a named difficulty (${Object.keys(named).join(', ')})`);
        }
        for (const c of opt.conditions ?? []) this.checkCondition(oat, c, p);
        for (const e of opt.effects ?? []) this.checkEffect(oat, e, p);
      });
    }
  }

  checkCondition(at, c, p) {
    const need = (field, map, label) => {
      if (c[field] === undefined) p.push(`${at}: condition "${c.type}" missing "${field}"`);
      else if (map && !map.has(c[field])) p.push(`${at}: condition "${c.type}" references unknown ${label} "${c[field]}"`);
    };
    switch (c.type) {
      case 'flag': case 'notFlag': need('flag', null); break;
      case 'skillAtLeast': need('skill', this.skills, 'skill'); need('value', null); break;
      case 'attributeAtLeast': need('attribute', this.attributes, 'attribute'); need('value', null); break;
      case 'hasItem': need('item', this.items, 'item'); break;
      case 'race': need('race', this.races, 'race'); break;
      case 'class': need('class', this.classes, 'class'); break;
      case 'hasPartyMember': need('member', this.partyMembers, 'party member'); break;
      case 'hasAbility': need('ability', this.abilities, 'ability'); break;
      case 'questAtStage': {
        need('quest', this.quests, 'quest');
        const q = this.quests.get(c.quest);
        if (q && !q.stages.some((s) => s.id === c.stage)) p.push(`${at}: quest "${c.quest}" has no stage "${c.stage}"`);
        break;
      }
      case 'questActive': case 'questDone': need('quest', this.quests, 'quest'); break;
      default: p.push(`${at}: unknown condition type "${c.type}"`);
    }
  }

  checkEffect(at, e, p) {
    const need = (field, map, label) => {
      if (e[field] === undefined) p.push(`${at}: effect "${e.type}" missing "${field}"`);
      else if (map && !map.has(e[field])) p.push(`${at}: effect "${e.type}" references unknown ${label} "${e[field]}"`);
    };
    switch (e.type) {
      case 'setFlag': need('flag', null); break;
      case 'addItem': case 'removeItem': need('item', this.items, 'item'); break;
      case 'recruit': need('member', this.partyMembers, 'party member'); break;
      case 'startQuest': case 'completeQuest': need('quest', this.quests, 'quest'); break;
      case 'advanceQuest': {
        need('quest', this.quests, 'quest');
        const q = this.quests.get(e.quest);
        if (q && !q.stages.some((s) => s.id === e.stage)) p.push(`${at}: quest "${e.quest}" has no stage "${e.stage}"`);
        break;
      }
      case 'startCombat':
        need('encounter', this.encounters, 'encounter');
        if (e.onWin !== undefined && !this.dialogues.has(e.onWin)) p.push(`${at}: startCombat onWin → unknown dialogue "${e.onWin}"`);
        break;
      case 'healParty': case 'endSlice': case 'end': break;
      default: p.push(`${at}: unknown effect type "${e.type}"`);
    }
  }

  /** Verify map object layers: NPC refs, dialogue refs, tile coords present. */
  checkMap(key, m, p) {
    const where = `maps/${key}`;
    for (const layer of m.layers ?? []) {
      if (layer.type !== 'objectgroup') continue;
      for (const obj of layer.objects ?? []) {
        const props = propsOf(obj);
        const at = `${where} object "${obj.name ?? obj.id}"`;
        const kind = props.kind;
        if (!kind) { p.push(`${at}: missing "kind" custom property (spawn|npc|object|barrier)`); continue; }
        if (props.tx === undefined || props.ty === undefined) p.push(`${at}: missing tx/ty tile-coordinate properties`);
        if (kind === 'npc' && !this.npcs.has(props.ref)) p.push(`${at}: npc ref "${props.ref}" not found in npcs.json`);
        if (kind === 'object' && !this.dialogues.has(props.dialogue)) p.push(`${at}: dialogue "${props.dialogue}" was not loaded`);
        if (kind === 'barrier' && !props.flag) p.push(`${at}: barrier needs a "flag" property that opens it`);
      }
    }
  }
}

/** Tiled custom properties array → plain object. */
export function propsOf(obj) {
  const out = {};
  for (const prop of obj.properties ?? []) out[prop.name] = prop.value;
  return out;
}
