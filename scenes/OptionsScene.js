/**
 * OptionsScene — display settings (vignette strength, film grain). Values are
 * presentation-only: ui/Settings.js persists them and applies them to the
 * atmosphere overlays in index.html. Changes take effect immediately.
 */
import { Settings } from '../ui/Settings.js';
import { Palette, Ink, displayStyle, proseStyle, monoStyle, track } from '../ui/Theme.js';
import { label, hairline, frameButton } from '../ui/widgets.js';

const PAD_X = 173;

export class OptionsScene extends Phaser.Scene {
  constructor() {
    super('Options');
  }

  create() {
    const sw = this.scale.width, sh = this.scale.height;
    this.add.rectangle(0, 0, sw, sh, Palette.bg1).setOrigin(0);

    label(this, PAD_X, 112, 'WINDS OF SILENCE', { size: 16, color: Ink.faint });
    const title = this.add.text(PAD_X, 150, 'OPTIONS', displayStyle({ fontSize: '59px' }));
    track(title, 8);
    label(this, sw - PAD_X, 124, 'CHANGES APPLY IMMEDIATELY', { size: 16, color: Ink.faint, origin: [1, 0] });

    this.rowObjects = [];
    this.buildRows();

    frameButton(this, PAD_X + 90, sh - 110, '← Title', {
      onClick: () => this.scene.start('MainMenu'),
    });
    frameButton(this, sw - PAD_X - 340, sh - 110, 'Restore Defaults', {
      framed: true,
      onClick: () => { Settings.reset(); this.buildRows(); },
    });
    frameButton(this, sw - PAD_X - 100, sh - 110, 'Keep These', {
      primary: true,
      onClick: () => this.scene.start('MainMenu'),
    });
  }

  buildRows() {
    this.rowObjects.forEach((o) => o.destroy());
    this.rowObjects = [];
    const put = (o) => { this.rowObjects.push(o); return o; };

    const x = PAD_X, w = 1320;
    let y = 330;
    put(label(this, x, y - 50, 'DISPLAY', { size: 13, color: Ink.faint }));
    put(hairline(this, x, y, w));

    y = this.sliderRow(put, x, w, y, 'Vignette — how dark is too dark',
      () => Settings.data.vignette,
      (v) => { Settings.data.vignette = Phaser.Math.Clamp(v, 0, 100); Settings.save(); Settings.apply(); });

    y = this.toggleRow(put, x, w, y, 'Film Grain',
      () => Settings.data.grain,
      (v) => { Settings.data.grain = v; Settings.save(); Settings.apply(); });
  }

  /** A settings row: name at left, stepper ‹ value › at right. */
  sliderRow(put, x, w, y, name, get, set) {
    const rowH = 96, cy = y + rowH / 2;
    put(this.add.text(x + 2, cy, name, proseStyle({ fontSize: '25px' })).setOrigin(0, 0.5));
    const value = put(this.add.text(x + w - 130, cy, `${get()}`,
      monoStyle({ fontSize: '18px', color: Ink.ink })).setOrigin(0.5));
    const step = (d) => { set(get() + d); value.setText(`${get()}`); };
    put(this.stepBtn(x + w - 230, cy, '−', () => step(-10)));
    put(this.stepBtn(x + w - 30, cy, '+', () => step(10)));
    put(hairline(this, x, y + rowH, w));
    return y + rowH;
  }

  /** A settings row with the design's toggle track. */
  toggleRow(put, x, w, y, name, get, set) {
    const rowH = 96, cy = y + rowH / 2;
    put(this.add.text(x + 2, cy, name, proseStyle({ fontSize: '25px' })).setOrigin(0, 0.5));
    const tw = 46, th = 20;
    const g = put(this.add.graphics());
    const state = put(this.add.text(x + w - 130, cy, '', monoStyle({ fontSize: '14px', color: Ink.dim })).setOrigin(0.5));
    const draw = () => {
      const on = get();
      g.clear();
      g.lineStyle(2, Palette.lineStrong, 1);
      g.strokeRect(x + w - tw, cy - th / 2, tw, th);
      g.fillStyle(on ? Palette.brass : Palette.inkFaint, 1);
      g.fillRect(x + w - tw + (on ? tw - 15 : 3), cy - th / 2 + 4, 12, th - 8);
      state.setText(on ? 'ON' : 'OFF');
    };
    draw();
    const zone = put(this.add.rectangle(x + w - tw / 2 - 60, cy, tw + 140, rowH, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }));
    zone.on('pointerdown', () => { set(!get()); draw(); });
    put(hairline(this, x, y + rowH, w));
    return y + rowH;
  }

  stepBtn(x, cy, glyph, onClick) {
    const c = this.add.container(x, cy);
    const g = this.add.graphics();
    g.lineStyle(2, Palette.line, 1);
    g.strokeRect(-19, -19, 38, 38);
    const t = this.add.text(0, 0, glyph, monoStyle({ fontSize: '20px', color: Ink.faint })).setOrigin(0.5);
    c.add([g, t]);
    c.setSize(38, 38).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => t.setColor(Ink.ink));
    c.on('pointerout', () => t.setColor(Ink.faint));
    c.on('pointerdown', onClick);
    return c;
  }
}
