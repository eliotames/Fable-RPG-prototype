/**
 * Theme — shared design tokens and text styles so every scene speaks the same
 * visual language: warm umber near-black, bone ink, oxblood accent, tarnished
 * brass (sparing). Negative space is the material; hairlines and diamonds are
 * the ornament.
 *
 * Type is settings-driven (ui/Settings.js): three switchable typeface sets
 * and a global font-size scale, both applied inside the style helpers so
 * every text object in the game follows them. Fonts are loaded from Google
 * Fonts in index.html (BootScene waits for them); every stack ends in a
 * system fallback so the game still renders offline.
 */
import { Settings } from './Settings.js';

/** Numeric colors for Graphics/Rectangle fills and strokes. */
export const Palette = {
  bgPage: 0x0c0a08,
  bg0: 0x14100c,
  bg1: 0x1b1611,
  bg2: 0x221c15,
  bg3: 0x2b231a,
  line: 0x3e3528,
  lineStrong: 0x645540,
  ink: 0xe8ddc4,
  inkDim: 0xb5a78b,
  inkFaint: 0x80735a,
  accent: 0x9c3b2e,
  accentBright: 0xd4684a,
  brass: 0xc09a52,
  verdigris: 0x7da18b,
};

/** String colors for text styles (same palette as above). */
export const Ink = {
  ink: '#e8ddc4',
  dim: '#b5a78b',
  faint: '#80735a',
  accent: '#9c3b2e',
  accentBright: '#d4684a',
  brass: '#c09a52',
  verdigris: '#7da18b',
};

const TYPEFACES = {
  default: { // programming-style: one clean mono face throughout
    display: '"Source Code Pro", Consolas, Menlo, monospace',
    prose: '"Source Code Pro", Consolas, Menlo, monospace',
    mono: '"Source Code Pro", Consolas, Menlo, monospace',
  },
  literary: { // the serif set
    display: 'Cormorant, Georgia, "Times New Roman", serif',
    prose: '"Crimson Pro", Georgia, "Times New Roman", serif',
    mono: '"IBM Plex Mono", Consolas, Menlo, monospace',
  },
  legible: { // humanist sans
    display: 'Roboto, "Helvetica Neue", Arial, sans-serif',
    prose: 'Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: '"Roboto Mono", Consolas, Menlo, monospace',
  },
};

/** Current typeface set (follows the Options screen). */
export function fonts() {
  return TYPEFACES[Settings.data.typeface] ?? TYPEFACES.default;
}

/** Apply the global font scale to a style's fontSize (e.g. '26px' @ 120 → '31px'). */
function scaled(style) {
  const scale = (Settings.data.fontScale ?? 100) / 100;
  const n = parseFloat(style.fontSize);
  if (!Number.isNaN(n) && scale !== 1) style.fontSize = `${Math.round(n * scale)}px`;
  return style;
}

/** Display face — headings, names, big numerals. */
export function displayStyle(overrides = {}) {
  return scaled({ fontFamily: fonts().display, fontSize: '59px', color: Ink.ink, ...overrides });
}

/** Prose face — body text, dialogue, descriptions. */
export function proseStyle(overrides = {}) {
  return scaled({ fontFamily: fonts().prose, fontSize: '29px', color: Ink.ink, lineSpacing: 13, ...overrides });
}

/** Mono face — labels, values, controls. Pair with widgets.label for caps+tracking. */
export function monoStyle(overrides = {}) {
  return scaled({ fontFamily: fonts().mono, fontSize: '18px', color: Ink.dim, ...overrides });
}

/**
 * Apply letter tracking if this Phaser build supports it (no-op otherwise,
 * which only loses the tracking, not the text).
 */
export function track(textObj, px) {
  if (typeof textObj.setLetterSpacing === 'function') textObj.setLetterSpacing(px);
  return textObj;
}
