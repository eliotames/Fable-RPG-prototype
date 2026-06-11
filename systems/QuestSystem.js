/**
 * QuestSystem — tracks quest stages defined in quests.json against GameState.
 * Stages are linear per quest (array order) but advanced explicitly by id from
 * dialogue effects, so branches can skip stages.
 */
import { GameState } from './GameState.js';

export const QuestSystem = {
  /** @type {object|null} ContentRegistry */
  reg: null,

  init(reg) {
    this.reg = reg;
  },

  start(questId) {
    if (GameState.quests[questId]) return;
    const quest = this.reg.quests.get(questId);
    GameState.quests[questId] = { stage: quest.stages[0].id, done: false };
  },

  advance(questId, stageId) {
    this.start(questId);
    GameState.quests[questId].stage = stageId;
  },

  complete(questId) {
    this.start(questId);
    GameState.quests[questId].done = true;
  },

  isActive(questId) {
    const q = GameState.quests[questId];
    return !!q && !q.done;
  },

  isDone(questId) {
    return !!GameState.quests[questId]?.done;
  },

  isAtStage(questId, stageId) {
    const q = GameState.quests[questId];
    return !!q && !q.done && q.stage === stageId;
  },

  /** Current stage definition ({id, journal, hint}) or null. */
  currentStage(questId) {
    const q = GameState.quests[questId];
    if (!q) return null;
    const quest = this.reg.quests.get(questId);
    return quest.stages.find((s) => s.id === q.stage) ?? null;
  },

  /** [{quest, stageDef, done}] for the journal panel. */
  journalEntries() {
    const out = [];
    for (const [questId, progress] of Object.entries(GameState.quests)) {
      const quest = this.reg.quests.get(questId);
      if (!quest) continue;
      out.push({ quest, stageDef: this.currentStage(questId), done: progress.done });
    }
    return out;
  },
};
