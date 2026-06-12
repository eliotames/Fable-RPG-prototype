/**
 * effects — ambient particles and UI motion shared by every scene, in the
 * vein of painterly immersive-sim menus: drifting dust motes, rising embers,
 * staggered entrances, pointer parallax, camera fades. Everything here obeys
 * ui/Settings.js (`particles` density, `animations` toggle) and degrades to
 * nothing when those are turned off — no scene logic ever depends on it.
 *
 * Uses the soft 'mote' texture generated in BootScene.
 */
import { Settings } from './Settings.js';
import { Palette } from './Theme.js';

const anim = () => Settings.data.animations !== false;
const density = () => (Settings.data.particles ?? 100) / 100;

/**
 * Slow drifting dust motes (and a few brighter embers when `embers` is set).
 * @param {{count?: number, embers?: number, tint?: number, depth?: number,
 *          region?: {x: number, y: number, w: number, h: number},
 *          route?: (obj: object) => object}} opts
 *   `route` lets dual-camera scenes claim each object (e.g. asWorld/asUI).
 * @returns {object[]} the created images (already animating)
 */
export function addMotes(scene, opts = {}) {
  const r = opts.region ?? { x: 0, y: 0, w: scene.scale.width, h: scene.scale.height };
  const route = opts.route ?? ((o) => o);
  const made = [];

  const spawn = (tint, alpha, scale, riseMin, riseMax) => {
    const img = scene.add.image(
      Phaser.Math.Between(r.x, r.x + r.w), Phaser.Math.Between(r.y, r.y + r.h), 'mote')
      .setTint(tint).setAlpha(alpha).setScale(scale).setDepth(opts.depth ?? 2);
    route(img);
    scene.tweens.add({
      targets: img,
      y: img.y - Phaser.Math.Between(riseMin, riseMax),
      x: img.x + Phaser.Math.Between(-40, 40),
      alpha: 0,
      duration: Phaser.Math.Between(5000, 12000),
      delay: Phaser.Math.Between(0, 4000),
      repeat: -1,
    });
    made.push(img);
  };

  const motes = Math.round((opts.count ?? 36) * density());
  for (let i = 0; i < motes; i++) {
    spawn(opts.tint ?? Palette.brass,
      Phaser.Math.FloatBetween(0.05, 0.22), Phaser.Math.FloatBetween(0.35, 1.1), 60, 180);
  }
  const embers = Math.round((opts.embers ?? 0) * density());
  for (let i = 0; i < embers; i++) {
    spawn(Palette.accentBright,
      Phaser.Math.FloatBetween(0.25, 0.5), Phaser.Math.FloatBetween(0.25, 0.55), 200, 420);
  }
  return made;
}

/**
 * Staggered entrance: each target fades up into place. Call after layout —
 * positions are captured here. Respects the animations setting.
 */
export function staggerIn(scene, targets, { rise = 26, delayStep = 45, duration = 380, delay = 0 } = {}) {
  if (!anim()) return;
  targets.forEach((t, i) => {
    if (!t || typeof t.setAlpha !== 'function') return;
    const toAlpha = t.alpha ?? 1, toY = t.y;
    t.setAlpha(0);
    t.y = toY + rise;
    scene.tweens.add({
      targets: t, alpha: toAlpha, y: toY,
      duration, delay: delay + i * delayStep, ease: 'Quad.easeOut',
    });
  });
}

/**
 * Pointer parallax: listed objects lean gently away from the cursor.
 * @param {Array<{obj: object, factor?: number}>} entries
 */
export function pointerParallax(scene, entries, strength = 10) {
  if (!anim()) return;
  const tracked = entries.map((e) => ({ obj: e.obj, factor: e.factor ?? 1, x: e.obj.x, y: e.obj.y }));
  scene.input.on('pointermove', (p) => {
    const dx = (p.x / scene.scale.width - 0.5) * 2;
    const dy = (p.y / scene.scale.height - 0.5) * 2;
    for (const t of tracked) {
      if (!t.obj.scene) continue; // destroyed
      t.obj.setPosition(t.x - dx * strength * t.factor, t.y - dy * strength * t.factor);
    }
  });
}

/** Fade the scene in from black (no-op when animations are off). */
export function fadeIn(scene, ms = 350) {
  if (!anim()) return;
  scene.cameras.main.fadeIn(ms, 12, 10, 8);
}
