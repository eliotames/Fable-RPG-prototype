/**
 * Settings — presentation preferences (atmosphere, motion, type). Pure UI:
 * values live in localStorage; consumers are the DOM overlays in index.html
 * (vignette), ui/effects.js (particles, animations) and ui/Theme.js
 * (typeface, font scale). No game system reads these.
 */

const KEY = 'wos-display-settings';

export const DEFAULTS = {
  vignette: 55,        // 0–100; intensity scales both opacity and gradient reach
  particles: 100,      // 0–200 % density of ambient motes/embers
  animations: true,    // entrance/hover/parallax motion (and the vignette breathe)
  fontScale: 100,      // 80–140 % applied to every text style
  typeface: 'default', // 'default' (Source Code Pro) | 'literary' | 'legible'
};

export const TYPEFACE_ORDER = ['default', 'literary', 'legible'];

export const Settings = {
  data: { ...DEFAULTS },

  load() {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY));
      if (stored && typeof stored === 'object') Object.assign(this.data, stored);
    } catch { /* no storage / bad JSON — keep defaults */ }
    return this.data;
  },

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* no storage */ }
  },

  reset() {
    this.data = { ...DEFAULTS };
    this.save();
    this.apply();
  },

  /** Push current values onto the index.html vignette layer. */
  apply() {
    if (typeof document === 'undefined') return;
    const vignette = document.getElementById('fx-vignette');
    if (!vignette) return;
    const t = Math.max(0, Math.min(100, this.data.vignette)) / 100;
    if (t === 0) {
      vignette.style.display = 'none';
      return;
    }
    // intensity tightens the gradient as well as raising opacity, so the top
    // of the slider is a genuinely heavy iris, not just a darker wash
    vignette.style.display = 'block';
    vignette.style.background = `radial-gradient(ellipse 72% 64% at 50% 46%, `
      + `transparent ${Math.round(52 - 28 * t)}%, `
      + `rgba(5,4,3,${(0.72 + 0.28 * t).toFixed(2)}) ${Math.round(130 - 42 * t)}%)`;
    vignette.style.opacity = String(Math.min(1, 0.1 + t * 0.95));
    vignette.classList.toggle('breathe', this.data.animations !== false);
  },
};
