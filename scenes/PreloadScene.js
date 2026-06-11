/**
 * PreloadScene — reads data/manifest.json, loads every listed content file
 * through the Phaser loader, validates each against its expected shape, then
 * cross-validates references. Any problem renders a readable error screen that
 * names the offending file and field — the game refuses to start on bad data.
 */
import { ContentRegistry } from '../systems/ContentRegistry.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { Colors, uiStyle, titleStyle } from '../ui/Theme.js';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
    /** @type {string[]} */
    this.loadErrors = [];
  }

  preload() {
    const manifest = this.cache.json.get('manifest');
    if (!manifest || !Array.isArray(manifest.files)) {
      this.loadErrors.push('data/manifest.json: missing or malformed (expected {"files": [...]})');
      return;
    }
    this.manifest = manifest;

    const seen = new Set();
    for (const entry of manifest.files) {
      if (!entry.key || !entry.type || !entry.path) {
        this.loadErrors.push(`manifest entry ${JSON.stringify(entry)}: needs key, type and path`);
        continue;
      }
      if (seen.has(entry.key)) {
        this.loadErrors.push(`manifest: duplicate key "${entry.key}"`);
        continue;
      }
      seen.add(entry.key);
      if (entry.type === 'map') this.load.tilemapTiledJSON(entry.key, entry.path);
      else this.load.json(entry.key, entry.path);
    }

    this.load.on('loaderror', (file) => {
      this.loadErrors.push(`${file.src}: failed to load (missing file or invalid JSON)`);
    });

    const barBg = this.add.rectangle(1280, 720, 840, 28, 0x22242c).setStrokeStyle(2, Colors.panelEdge);
    const bar = this.add.rectangle(1280 - 416, 720, 1, 20, Colors.accent).setOrigin(0, 0.5);
    this.add.text(1280, 660, 'Loading content…', uiStyle({ fontSize: '32px' })).setOrigin(0.5);
    this.load.on('progress', (v) => bar.setSize(Math.max(1, 832 * v), 20));
    this.load.on('complete', () => { barBg.destroy(); bar.destroy(); });
  }

  create() {
    if (this.loadErrors.length) return this.showErrors(this.loadErrors);

    const reg = new ContentRegistry();
    for (const entry of this.manifest.files) {
      const json = entry.type === 'map'
        ? this.cache.tilemap.get(entry.key)?.data
        : this.cache.json.get(entry.key);
      if (!json) {
        reg.problems.push(`${entry.path}: loaded but empty or unreadable`);
        continue;
      }
      reg.ingest(entry.type, entry.key, json, entry.path);
    }
    try {
      reg.finalize();
    } catch (e) {
      return this.showErrors(e.problems ?? [String(e)]);
    }

    this.registry.set('content', reg);
    this.registry.set('contentFileCount', this.manifest.files.length);
    QuestSystem.init(reg);
    this.scene.start('MainMenu');
  }

  /** @param {string[]} problems */
  showErrors(problems) {
    console.error('Content validation failed:\n' + problems.join('\n'));
    this.cameras.main.setBackgroundColor('#1a0b0b');
    this.add.text(80, 60, 'Content error', titleStyle({ color: '#e06c5f', fontSize: '68px' }));
    this.add.text(80, 160,
      'The game cannot start because content files failed validation.\n'
      + 'Fix the problems below (file → field: problem) and reload:',
      uiStyle({ fontSize: '30px', color: '#d8c8c0' }));
    const shown = problems.slice(0, 24);
    const more = problems.length > shown.length ? `\n… and ${problems.length - shown.length} more (see console)` : '';
    this.add.text(80, 280, shown.join('\n') + more, {
      fontFamily: 'Consolas, Menlo, monospace', fontSize: '26px',
      color: '#ffd9c0', wordWrap: { width: 2400 }, lineSpacing: 10,
    });
  }
}
