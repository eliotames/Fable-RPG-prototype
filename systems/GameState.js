/**
 * GameState — mutable state of the current run: player character, party,
 * inventory, story flags, quest stages. A plain singleton so any scene or
 * system can read it; content JSON manipulates it only through Script.js
 * effects and QuestSystem.
 */

export const GameState = {
  /** @type {object|null} player character built by CharacterFactory */
  player: null,
  /** @type {object[]} recruited members (CharacterFactory output), excludes player */
  party: [],
  /** @type {Object<string, number>} item id → quantity */
  inventory: {},
  /** @type {Object<string, any>} story flags set by dialogue effects */
  flags: {},
  /** @type {Object<string, {stage: string, done: boolean}>} quest id → progress */
  quests: {},
  /** Outcome of the slice, set by the endSlice effect. */
  ending: null,

  reset() {
    this.player = null;
    this.party = [];
    this.inventory = {};
    this.flags = {};
    this.quests = {};
    this.ending = null;
  },

  /** Player + recruits, in turn-order-agnostic display order. */
  fullParty() {
    return this.player ? [this.player, ...this.party] : [...this.party];
  },

  addItem(id, qty = 1) {
    this.inventory[id] = (this.inventory[id] ?? 0) + qty;
  },

  removeItem(id, qty = 1) {
    const left = (this.inventory[id] ?? 0) - qty;
    if (left > 0) this.inventory[id] = left;
    else delete this.inventory[id];
  },

  hasItem(id) {
    return (this.inventory[id] ?? 0) > 0;
  },

  setFlag(flag, value = true) {
    this.flags[flag] = value;
  },

  hasFlag(flag) {
    return !!this.flags[flag];
  },

  hasPartyMember(id) {
    return this.party.some((m) => m.sourceId === id);
  },

  /** Does anyone in the party (incl. player) know this ability? */
  partyHasAbility(abilityId) {
    return this.fullParty().some((m) => m.abilities.includes(abilityId));
  },

  /** Highest value of a skill across the party — used for combat knowledge. */
  bestSkill(skillId) {
    return Math.max(0, ...this.fullParty().map((m) => m.skills[skillId] ?? 0));
  },
};
