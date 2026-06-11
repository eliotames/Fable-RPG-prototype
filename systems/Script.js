/**
 * Script — the one interpreter for content-authored conditions and effects.
 * Dialogue options, interactables, puzzle solutions, recruitment, loot, and
 * combat starts are all expressed with these; the engine never special-cases
 * a particular NPC or object.
 *
 * Conditions read GameState/registry. Effects mutate GameState and call back
 * into the running scene through `hooks` for anything scene-level
 * (startCombat, endSlice, end).
 */
import { GameState } from './GameState.js';
import { QuestSystem } from './QuestSystem.js';
import { buildPartyMember } from './CharacterFactory.js';

/**
 * @param {object[]} conditions
 * @param {object} reg ContentRegistry
 * @returns {boolean} true when every condition passes (empty list = true)
 */
export function evaluateConditions(conditions, reg) {
  return (conditions ?? []).every((c) => evaluateCondition(c, reg));
}

function evaluateCondition(c, reg) {
  const player = GameState.player;
  switch (c.type) {
    case 'flag': return GameState.hasFlag(c.flag);
    case 'notFlag': return !GameState.hasFlag(c.flag);
    // Skill conditions use the PLAYER's skill: it is the player who speaks/acts
    // in dialogue. Party-wide capability is expressed via hasPartyMember/hasAbility.
    case 'skillAtLeast': return (player?.skills[c.skill] ?? 0) >= c.value;
    case 'attributeAtLeast': return (player?.attributes[c.attribute] ?? 0) >= c.value;
    case 'hasItem': return GameState.hasItem(c.item);
    case 'race': return player?.raceId === c.race;
    case 'class': return player?.classId === c.class;
    case 'hasPartyMember': return GameState.hasPartyMember(c.member);
    case 'hasAbility': return GameState.partyHasAbility(c.ability);
    case 'questAtStage': return QuestSystem.isAtStage(c.quest, c.stage);
    case 'questActive': return QuestSystem.isActive(c.quest);
    case 'questDone': return QuestSystem.isDone(c.quest);
    default:
      console.warn(`Unknown condition type "${c.type}" — treating as false`);
      return false;
  }
}

/**
 * Apply a list of effects in order.
 * @param {object[]} effects
 * @param {object} reg ContentRegistry
 * @param {{startCombat?: Function, endSlice?: Function, end?: Function,
 *          notify?: (text: string) => void}} hooks scene-level callbacks
 */
export function applyEffects(effects, reg, hooks = {}) {
  for (const e of effects ?? []) applyEffect(e, reg, hooks);
}

function applyEffect(e, reg, hooks) {
  const notify = hooks.notify ?? (() => {});
  switch (e.type) {
    case 'setFlag':
      GameState.setFlag(e.flag, e.value ?? true);
      break;
    case 'addItem': {
      const qty = e.qty ?? 1;
      GameState.addItem(e.item, qty);
      const item = reg.items.get(e.item);
      notify(`Received: ${item?.name ?? e.item}${qty > 1 ? ` ×${qty}` : ''}`);
      break;
    }
    case 'removeItem':
      GameState.removeItem(e.item, e.qty ?? 1);
      break;
    case 'recruit': {
      if (GameState.hasPartyMember(e.member)) break;
      const member = buildPartyMember(reg, e.member);
      GameState.party.push(member);
      notify(`${member.name} joins the party!`);
      break;
    }
    case 'startQuest': {
      QuestSystem.start(e.quest);
      notify(`Quest started: ${reg.quests.get(e.quest)?.name ?? e.quest}`);
      break;
    }
    case 'advanceQuest':
      QuestSystem.advance(e.quest, e.stage);
      notify(`Journal updated: ${reg.quests.get(e.quest)?.name ?? e.quest}`);
      break;
    case 'completeQuest':
      QuestSystem.complete(e.quest);
      notify(`Quest complete: ${reg.quests.get(e.quest)?.name ?? e.quest}`);
      break;
    case 'healParty': {
      const fraction = e.fraction ?? 1;
      for (const m of GameState.fullParty()) {
        m.hp = Math.min(m.maxHp, Math.round(m.hp + m.maxHp * fraction));
        m.focus = m.maxFocus;
      }
      break;
    }
    case 'startCombat':
      hooks.startCombat?.(e);
      break;
    case 'endSlice':
      GameState.ending = { outcome: e.outcome ?? 'win', epilogue: e.epilogue ?? '' };
      hooks.endSlice?.(GameState.ending);
      break;
    case 'end':
      hooks.end?.();
      break;
    default:
      console.warn(`Unknown effect type "${e.type}" — skipped`);
  }
}
