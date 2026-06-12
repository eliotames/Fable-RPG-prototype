/**
 * Settings — display preferences for the UI chrome (vignette strength, film
 * grain). Pure presentation: values live in localStorage and are applied to
 * the DOM overlay layers defined in index.html. No game system reads these.
 */

const KEY = 'wos-display-settings';

export const DEFAULTS = { vignette: 55, grain: true };

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
