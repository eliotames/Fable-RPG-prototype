/**
 * widgets — shared UI builders in the house style (hairline panels, tick-frame
 * corners, mono caps labels, framed buttons, thin stat bars, rules, toasts).
 * All return plain Phaser game objects / containers / small apis.
 */
import { Palette, Ink, monoStyle, track } from './Theme.js';
import { Settings } from './Settings.js';

/** Hairline-bordered panel with a near-black fill. */
export function panel(scene, x, y, w, h, alpha = 0.92) {
  const g = scene.add.graphics();
  g.fillStyle(Palette.bgPage, alpha);
  g.fillRect(x, y, w, h);
  g.lineStyle(2, Palette.line, 1);
  g.strokeRect(x, y, w, h);
  return g;
}

/** Corner ticks (the tick-frame ornament) drawn around a rect. */
export function tickFrame(scene, x, y, w, h, size = 15) {
  const g = scene.add.graphics();
  g.lineStyle(2, Palette.lineStrong, 1);
  g.beginPath();
  g.moveTo(x, y + size); g.lineTo(x, y); g.lineTo(x + size, y);
  g.moveTo(x + w - size, y + h); g.lineTo(x + w, y + h); g.lineTo(x + w, y + h - size);
  g.strokePath();
  return g;
}

/** Horizontal hairline. */
export function hairline(scene, x, y, w, color = Palette.line) {
  const g = scene.add.graphics();
  g.lineStyle(2, color, 1);
  g.lineBetween(x, y, x + w, y);
  return g;
}

/** Centered rule ornament: ── ◆ ── */
export function rule(scene, cx, y, w, glyph = '◆') {
  const c = scene.add.container(cx, y);
  const g = scene.add.graphics();
  g.lineStyle(2, Palette.line, 1);
  g.lineBetween(-w / 2, 0, -22, 0);
  g.lineBetween(22, 0, w / 2, 0);
  c.add(g);
  c.add(scene.add.text(0, 0, glyph, monoStyle({ fontSize: '12px', color: Ink.faint })).setOrigin(0.5));
  return c;
}

/**
 * Mono caps label with letter tracking — the design's `.label`.
 * @param {{size?:number, color?:string, spacing?:number, origin?:[number,number]}} opts
 */
export function label(scene, x, y, text, opts = {}) {
  const size = opts.size ?? 18;
  const t = scene.add.text(x, y, String(text).toUpperCase(),
    monoStyle({ fontSize: `${size}px`, color: opts.color ?? Ink.dim }));
  track(t, opts.spacing ?? Math.round(size * 0.22));
  if (opts.origin) t.setOrigin(...opts.origin);
  return t;
}

/**
 * Clickable text button (kept lightweight for inline options/rows).
 * @param {{onClick: Function, style?: object, disabled?: boolean, hoverColor?: string}} opts
 */
export function textButton(scene, x, y, text, opts) {
  const style = { ...opts.style };
  const txt = scene.add.text(x, y, text, style);
  if (opts.disabled) {
    txt.setColor(Ink.faint).setAlpha(0.7);
    return txt;
  }
  txt.setInteractive({ useHandCursor: true });
  const baseColor = style.color ?? Ink.dim;
  const hover = opts.hoverColor ?? Ink.ink;
  txt.on('pointerover', () => txt.setColor(hover));
  txt.on('pointerout', () => txt.setColor(baseColor));
  txt.on('pointerdown', () => opts.onClick());
  return txt;
}

/**
 * Framed mono-caps button (`.btn` / `.btn.framed` / `.btn.primary`).
 * Returns a container centered on (x, y) exposing {width, height, setEnabled}.
 * @param {{onClick: Function, primary?: boolean, framed?: boolean,
 *          disabled?: boolean, size?: number, padX?: number, padY?: number}} opts
 */
export function frameButton(scene, x, y, text, opts = {}) {
  const size = opts.size ?? 18;
  const padX = opts.padX ?? 34, padY = opts.padY ?? 16;
  const c = scene.add.container(x, y);
  const prefix = opts.primary ? '◆  ' : '';
  const t = scene.add.text(0, 0, prefix + String(text).toUpperCase(),
    monoStyle({ fontSize: `${size}px`, color: opts.primary ? Ink.ink : Ink.dim })).setOrigin(0.5);
  track(t, Math.round(size * 0.24));
  const w = t.width + padX * 2, h = t.height + padY * 2;
  const border = scene.add.graphics();
  const drawBorder = (color, visible) => {
    border.clear();
    if (!visible) return;
    border.lineStyle(2, color, 1);
    border.strokeRect(-w / 2, -h / 2, w, h);
  };
  const framed = opts.framed || opts.primary;
  drawBorder(opts.primary ? Palette.lineStrong : Palette.line, framed);
  c.add([border, t]);
  c.setSize(w, h);
  if (opts.disabled) {
    c.setAlpha(0.35);
    return c;
  }
  c.setInteractive({ useHandCursor: true });
  c.on('pointerover', () => {
    t.setColor(Ink.ink);
    drawBorder(opts.primary ? Palette.accent : framed ? Palette.lineStrong : Palette.line, true);
    if (Settings.data.animations !== false) {
      scene.tweens.add({ targets: c, scale: 1.04, duration: 110, ease: 'Quad.easeOut' });
    }
  });
  c.on('pointerout', () => {
    t.setColor(opts.primary ? Ink.ink : Ink.dim);
    drawBorder(opts.primary ? Palette.lineStrong : Palette.line, framed);
    if (Settings.data.animations !== false) {
      scene.tweens.add({ targets: c, scale: 1, duration: 110, ease: 'Quad.easeOut' });
    }
  });
  c.on('pointerdown', () => opts.onClick?.());
  return c;
}

/**
 * Thin stat bar (`.bar`) — track in bg3, fill in the given color.
 * Returns {update(value, max), destroy, gameObject}.
 */
export function statBar(scene, x, y, w, h, color) {
  const g = scene.add.graphics();
  const api = {
    gameObject: g,
    update(value, max) {
      g.clear();
      g.fillStyle(Palette.bg3, 1);
      g.fillRect(x, y, w, h);
      const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
      g.fillStyle(color, 1);
      g.fillRect(x, y, Math.round(w * frac), h);
    },
    destroy() { g.destroy(); },
  };
  return api;
}

/** Floating notification that rises and fades (loot, quest updates). */
export function toast(scene, text, index = 0) {
  const t = scene.add.text(scene.scale.width / 2, 220 + index * 60, `◆  ${String(text).toUpperCase()}`,
    monoStyle({ fontSize: '22px', color: Ink.ink, backgroundColor: '#0c0a08f0', padding: { x: 26, y: 14 } }))
    .setOrigin(0.5, 0).setDepth(5000).setScrollFactor(0);
  track(t, 4);
  scene.tweens.add({
    targets: t, y: t.y - 36, alpha: 0, delay: 2200, duration: 700,
    onComplete: () => t.destroy(),
  });
  return t;
}

/** Queue toasts so several effects in a row stack instead of overlap. */
export function makeNotifier(scene) {
  let count = 0;
  return (text) => toast(scene, text, count++ % 5);
}
