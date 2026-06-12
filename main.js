/**
 * Winds of Silence — entry point. Imports every scene and starts the game.
 * The module graph pulls in all systems/ui code; index.html loads Phaser
 * (a classic script providing the global) before this deferred module runs.
 *
 * All game content lives in data/*.json; engine code never hardcodes content.
 */
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { CharacterCreationScene } from './scenes/CharacterCreationScene.js';
import { ExplorationScene } from './scenes/ExplorationScene.js';
import { DialogueScene } from './scenes/DialogueScene.js';
import { CombatScene } from './scenes/CombatScene.js';
import { EndScene } from './scenes/EndScene.js';
import { GameState } from './systems/GameState.js';
import { QuestSystem } from './systems/QuestSystem.js';
import * as Script from './systems/Script.js';

/** @type {object} Phaser.Types.Core.GameConfig */
const config = {
  type: Phaser.AUTO,
  parent: 'game', // Phaser falls back to <body> if no #game element exists
  width: 2560,
  height: 1440,
  backgroundColor: '#0b0c10',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    BootScene, PreloadScene, MainMenuScene, CharacterCreationScene,
    ExplorationScene, DialogueScene, CombatScene, EndScene,
  ],
};

const game = new Phaser.Game(config);

// Console/debug handles, also used by tests/smoke-browser.mjs — modules are
// otherwise closed off from the page, so expose the game and core systems.
globalThis.game = game;
globalThis.WoS = { GameState, QuestSystem, Script };
