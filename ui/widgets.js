/**
 * widgets — small shared UI builders (panels, buttons, bars) used by every
 * scene. All return plain Phaser game objects / containers.
 */
import { Colors, uiStyle } from './Theme.js';

/** Bordered panel rectangle. */
export function panel(scene, x, y, w, h, alpha = 0.94) {
  const g = scene.add.graphics();
  g.fillStyle(Colors.panel, alpha);
  g.fillRect(x, y, w, h);
  g.lineStyle(1, Colors.panelEdge, 1);
  g.strokeRect(x, y, w, h);
  return g;
}

/**
 * Clickable text button. Returns the text object.
 * @param {{onClick: Function, style?: object, disabled?: boolean}} opts
 */
export function textButton(scene, x, y, label, opts) {
  const style = uiStyle({ fontSize: '16px', ...opts.style });
  const txt = scene.add.text(x, y, label, style);
  if (opts.disabled) {
    txt.setColor(Colors.disabled);
    return txt;
  }
  txt.setInteractive({ useHandCursor: true });
  const baseColor = style.color ?? Colors.text;
  txt.on('pointerover', () => txt.setColor('#ffe9b0'));
  txt.on('pointerout', () => txt.setColor(baseColor));
  txt.on('pointerdown', () => opts.onClick());
  return txt;
}

/**
 * Horizontal stat bar (HP/Focus/Toughness). Returns {update(value, max)}.
 */
export function statBar(scene, x, y, w, h, color, bgColor = 0x22242c) {
  const g = scene.add.graphics();
  const api = {
    gameObject: g,
    update(value, max) {
      g.clear();
      g.fillStyle(bgColor, 1);
      g.fillRect(x, y, w, h);
      const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
      g.fillStyle(color, 1);
      g.fillRect(x, y, w * frac, h);
      g.lineStyle(1, Colors.panelEdge, 1);
      g.strokeRect(x, y, w, h);
    },
    destroy() { g.destroy(); },
  };
  return api;
}

/** Floating notification text that rises and fades (loot, quest updates). */
export function toast(scene, text, index = 0) {
  const t = scene.add.text(scene.scale.width / 2, 110 + index * 26, text,
    uiStyle({ fontSize: '16px', color: '#ffe9b0', backgroundColor: '#14161dee', padding: { x: 10, y: 4 } }))
    .setOrigin(0.5, 0).setDepth(5000).setScrollFactor(0);
  scene.tweens.add({
    targets: t, y: t.y - 18, alpha: 0, delay: 2200, duration: 700,
    onComplete: () => t.destroy(),
  });
  return t;
}

/** Queue toasts so several effects in a row stack instead of overlap. */
export function makeNotifier(scene) {
  let count = 0;
  return (text) => {
    toast(scene, text, count++ % 5);
  };
}
