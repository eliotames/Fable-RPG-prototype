/**
 * BootScene — generates all placeholder textures programmatically (zero binary
 * assets) and fetches the content manifest. PreloadScene then loads everything
 * the manifest lists.
 *
 * Generated textures:
 *  - 'tiles': a 1-row isometric tile sheet (128×64 per tile) used by the tilemap.
 *    Tile gids (in map JSON): 1 grass, 2 path, 3 water, 4 stone, 5 rock wall,
 *    6 hush (deadened ground), 7 field, 8 bridge.
 *  - 'token': a white circle, tinted per character/NPC at runtime.
 */

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.json('manifest', 'data/manifest.json');
  }

  create() {
    this.makeTileSheet();
    this.makeToken();
    this.scene.start('Preload');
  }

  makeTileSheet() {
    const W = 128, H = 64;
    // fill + edge per tile; "inner" draws a second smaller diamond (walls/water).
    const defs = [
      { fill: 0x4a6741, edge: 0x3a5234 },                       // 1 grass
      { fill: 0x8a7a5c, edge: 0x6e6149 },                       // 2 path
      { fill: 0x2e4a66, edge: 0x223a52, inner: 0x3a5e80 },      // 3 water
      { fill: 0x6e7078, edge: 0x55575e },                       // 4 stone floor
      { fill: 0x494b52, edge: 0x2c2e33, inner: 0x5d5f66 },      // 5 rock wall
      { fill: 0x16131e, edge: 0x0c0a10, inner: 0x221d2e },      // 6 hush ground
      { fill: 0x5d7a3f, edge: 0x4a6233 },                       // 7 field
      { fill: 0x7a5c3d, edge: 0x614a31, inner: 0x8a6c4a },      // 8 bridge planks
    ];
    const g = this.add.graphics();
    const diamond = (cx, cy, w, h) => [
      { x: cx, y: cy - h / 2 }, { x: cx + w / 2, y: cy },
      { x: cx, y: cy + h / 2 }, { x: cx - w / 2, y: cy },
    ];
    defs.forEach((d, i) => {
      const cx = i * W + W / 2, cy = H / 2;
      const outer = diamond(cx, cy, W - 2, H - 2);
      g.fillStyle(d.fill, 1);
      g.fillPoints(outer, true);
      g.lineStyle(2, d.edge, 1);
      g.strokePoints([...outer, outer[0]]);
      if (d.inner !== undefined) {
        g.fillStyle(d.inner, 1);
        g.fillPoints(diamond(cx, cy, W * 0.55, H * 0.55), true);
      }
    });
    g.generateTexture('tiles', W * defs.length, H);
    g.destroy();
  }

  makeToken() {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(28, 28, 24);
    g.lineStyle(4, 0x000000, 0.5);
    g.strokeCircle(28, 28, 24);
    g.generateTexture('token', 56, 56);
    g.destroy();
  }
}
