/**
 * OptionsScene — presentation settings, all of them live: vignette strength,
 * film grain, particle density, UI animations, font size, typeface, and the
 * dialogue letterbox. ui/Settings.js persists and applies them; rows that
 * change type or particles restart this scene so the change is visible
 * immediately. Nothing here touches game systems.
 */
import { Settings, TYPEFACE_ORDER } from '../ui/Settings.js';
import { Palette, Ink, displayStyle, proseStyle, monoStyle, track } from '../ui/Theme.js';
import { label, hairline, frameButton } from '../ui/widgets.js';
import { addMotes, staggerIn, fadeIn } from '../ui/effects.js';

const PAD_X = 173;
const ROW_W = 1500;
const ROW_H = 92;
const TYPEFACE_NAMES = { default: 'DEFAULT — SOURCE CODE', literary: 'LITERARY — SERIF', legible: 'LEGIBLE — ROBOTO' };

export class OptionsScene extends Phaser.Scene {
  constructor() {
    super('Options');
  }

  create() {
    const sw = this.scale.width, sh = this.scale.height;
    this.add.rectangle(0, 0, sw, sh, Palette.bg1).setOrigin(0);
    addMotes(this, { count: 16, depth: 1 });
    fadeIn(this, 250);

    const header = [
      label(this, PAD_X, 104, 'WINDS OF SILENCE', { size: 17, color: Ink.faint }),
      track(this.add.text(PAD_X, 142, 'OPTIONS', displayStyle({ fontSize: '59px' })), 8),
      label(this, sw - PAD_X, 118, 'CHANGES APPLY IMMEDIATELY', { size: 17, color: Ink.faint, origin: [1, 0] }),
    ];

    this.rowObjects = [];
    this.buildRows();
    staggerIn(this, [...header, ...this.rowObjects], { rise: 18, delayStep: 14, duration: 280 });

    frameButton(this, PAD_X + 90, sh - 108, '← Title', {
      onClick: () => this.scene.start('MainMenu'),
    });
    frameButton(this, sw - PAD_X - 370, sh - 108, 'Restore Defaults', {
      framed: true,
      onClick: () => { Settings.reset(); this.scene.restart(); },
    });
    frameButton(this, sw - PAD_X - 105, sh - 108, 'Keep These', {
      primary: true,
      onClick: () => this.scene.start('MainMenu'),
    });
  }

  buildRows() {
    this.rowObjects.forEach((o) => o.destroy());
    this.rowObjects = [];
    const put = (o) => { this.rowObjects.push(o); return o; };
    const d = Settings.data;
    const set = (key, value, restart = false) => {
      d[key] = value;
      Settings.save();
      Settings.apply();
      if (restart) this.scene.restart();
    };
    const x = PAD_X;
    let y = 290;

    const section = (name) => {
      put(label(this, x, y, name, { size: 15, color: Ink.faint }));
      y += 44;
      put(hairline(this, x, y, ROW_W));
    };

    section('ATMOSPHERE');
    y = this.sliderRow(put, x, y, 'Vignette — how dark is too dark', 0, 100, 10,
      () => d.vignette, (v) => set('vignette', v));
    y = this.toggleRow(put, x, y, 'Film Grain',
      () => d.grain, (v) => set('grain', v));
    y = this.sliderRow(put, x, y, 'Particles — drifting dust and embers', 0, 100, 25,
      () => d.particles, (v) => set('particles', v, true));
    y = this.toggleRow(put, x, y, 'Letterbox in Dialogue',
      () => d.letterbox, (v) => set('letterbox', v));

    y += 56;
    section('INTERFACE');
    y = this.toggleRow(put, x, y, 'UI Animations — entrances, hover motion, parallax',
      () => d.animations, (v) => set('animations', v));
    y = this.sliderRow(put, x, y, 'Font Size', 80, 140, 10,
      () => d.fontScale, (v) => set('fontScale', v, true), (v) => `${v}%`);
    y = this.choiceRow(put, x, y, 'Typeface', TYPEFACE_ORDER,
      () => d.typeface, (v) => set('typeface', v, true), (v) => TYPEFACE_NAMES[v] ?? v);
  }

  /** Row: name at left, − value + at right. */
  sliderRow(put, x, y, name, min, max, step, get, set, fmt = (v) => String(v)) {
    const cy = y + ROW_H / 2;
    put(this.add.text(x + 2, cy, name, proseStyle({ fontSize: '27px' })).setOrigin(0, 0.5));
    const value = put(this.add.text(x + ROW_W - 145, cy, fmt(get()),
      monoStyle({ fontSize: '20px', color: Ink.ink })).setOrigin(0.5));
    const adjust = (delta) => {
      set(Phaser.Math.Clamp(get() + delta, min, max));
      value.setText(fmt(get()));
    };
    put(this.stepBtn(x + ROW_W - 262, cy, '−', () => adjust(-step)));
    put(this.stepBtn(x + ROW_W - 28, cy, '+', () => adjust(step)));
    put(hairline(this, x, y + ROW_H, ROW_W));
    return y + ROW_H;
  }

  /** Row with an on/off toggle track. */
  toggleRow(put, x, y, name, get, set) {
    const cy = y + ROW_H / 2;
    put(this.add.text(x + 2, cy, name, proseStyle({ fontSize: '27px' })).setOrigin(0, 0.5));
    const tw = 50, th = 22;
    const g = put(this.add.graphics());
    const state = put(this.add.text(x + ROW_W - tw - 36, cy, '', monoStyle({ fontSize: '16px', color: Ink.dim })).setOrigin(1, 0.5));
    const draw = () => {
      const on = get();
      g.clear();
      g.lineStyle(2, Palette.lineStrong, 1);
      g.strokeRect(x + ROW_W - tw - 8, cy - th / 2, tw, th);
      g.fillStyle(on ? Palette.brass : Palette.inkFaint, 1);
      g.fillRect(x + ROW_W - tw - 8 + (on ? tw - 17 : 4), cy - th / 2 + 4, 13, th - 8);
      state.setText(on ? 'ON' : 'OFF');
    };
    draw();
    const zone = put(this.add.rectangle(x + ROW_W - 110, cy, 260, ROW_H, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }));
    zone.on('pointerdown', () => { set(!get()); draw(); });
    put(hairline(this, x, y + ROW_H, ROW_W));
    return y + ROW_H;
  }

  /** Row: name at left, ‹ value › cycling through choices at right. */
  choiceRow(put, x, y, name, values, get, set, fmt = (v) => v) {
    const cy = y + ROW_H / 2;
    put(this.add.text(x + 2, cy, name, proseStyle({ fontSize: '27px' })).setOrigin(0, 0.5));
    const value = put(this.add.text(x + ROW_W - 175, cy, fmt(get()),
      monoStyle({ fontSize: '17px', color: Ink.ink })).setOrigin(0.5));
    track(value, 2);
    const cycle = (dir) => {
      const i = (values.indexOf(get()) + dir + values.length) % values.length;
      set(values[i]);
    };
    put(this.stepBtn(x + ROW_W - 320, cy, '‹', () => cycle(-1)));
    put(this.stepBtn(x + ROW_W - 28, cy, '›', () => cycle(1)));
    put(hairline(this, x, y + ROW_H, ROW_W));
    return y + ROW_H;
  }

  stepBtn(x, cy, glyph, onClick) {
    const c = this.add.container(x, cy);
    const g = this.add.graphics();
    g.lineStyle(2, Palette.line, 1);
    g.strokeRect(-20, -20, 40, 40);
    const t = this.add.text(0, 0, glyph, monoStyle({ fontSize: '22px', color: Ink.faint })).setOrigin(0.5);
    c.add([g, t]);
    c.setSize(40, 40).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => t.setColor(Ink.ink));
    c.on('pointerout', () => t.setColor(Ink.faint));
    c.on('pointerdown', onClick);
    return c;
  }
}
