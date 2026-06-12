/**
 * Settings — presentation preferences (atmosphere, motion, type). Pure UI:
 * values live in localStorage; consumers are the DOM overlays in index.html
 * (vignette, grain), ui/effects.js (particles, animations), ui/Theme.js
 * (typeface, font scale) and DialogueScene (letterbox). No game system reads
 * these.
 */

const KEY = 'wos-display-settings';

export const DEFAULTS = {
  vignette: 55,        // 0–100 overlay opacity
  grain: true,         // film grain overlay
  particles: 100,      // 0–100 density of ambient motes/embers
  animations: true,    // entrance/hover/parallax motion
  fontScale: 100,      // 80–140 % applied to every text style
  typeface: 'default', // 'default' (Source Code Pro) | 'literary' | 'legible'
  letterbox: true,     // letterbox bars in dialogue
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

  /** Push current values onto the index.html overlay layers. */
  apply() {
    if (typeof document === 'undefined') return;
    const vignette = document.getElementById('fx-vignette');
    if (vignette) vignette.style.opacity = String(this.data.vignette / 100);
    const grain = document.getElementById('fx-grain');
    if (grain) grain.style.display = this.data.grain ? 'block' : 'none';
  },
};
