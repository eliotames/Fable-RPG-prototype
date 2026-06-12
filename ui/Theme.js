/**
 * Theme — shared design tokens and text styles so every scene speaks the same
 * visual language: warm umber near-black, bone ink, oxblood accent, tarnished
 * brass (sparing). Serif display/prose faces with a mono face for labels.
 * Negative space is the material; hairlines and diamonds are the ornament.
 *
 * Fonts are loaded from Google Fonts in index.html (BootScene waits for them);
 * every stack ends in a system fallback so the game still renders offline.
 */

/** Numeric colors for Graphics/Rectangle fills and strokes. */
export const Palette = {
  bgPage: 0x0c0a08,
  bg0: 0x14100c,
  bg1: 0x1b1611,
  bg2: 0x221c15,
  bg3: 0x2b231a,
  line: 0x382f24,
  lineStrong: 0x564937,
  ink: 0xd3c5ac,
  inkDim: 0x93856b,
  inkFaint: 0x5d5343,
  accent: 0x9c3b2e,
  accentBright: 0xc2563d,
  brass: 0xa8823c,
  verdigris: 0x56705f,
};

/** String colors for text styles (same palette as above). */
export const Ink = {
  ink: '#d3c5ac',
  dim: '#93856b',
  faint: '#5d5343',
  accent: '#9c3b2e',
  accentBright: '#c2563d',
  brass: '#a8823c',
  verdigris: '#56705f',
};

export const Fonts = {
  display: 'Cormorant, Georgia, "Times New Roman", serif',
  prose: '"Crimson Pro", Georgia, "Times New Roman", serif',
  mono: '"IBM Plex Mono", Consolas, Menlo, monospace',
};

/** Display face — headings, names, big numerals. */
export function displayStyle(overrides = {}) {
  return { fontFamily: Fonts.display, fontSize: '59px', color: Ink.ink, ...overrides };
}

/** Prose face — body text, dialogue, descriptions. */
export function proseStyle(overrides = {}) {
  return { fontFamily: Fonts.prose, fontSize: '26px', color: Ink.ink, lineSpacing: 12, ...overrides };
}

/** Mono face — labels, values, controls. Pair with widgets.label for caps+tracking. */
export function monoStyle(overrides = {}) {
  return { fontFamily: Fonts.mono, fontSize: '16px', color: Ink.dim, ...overrides };
}

/**
 * Apply letter tracking if this Phaser build supports it (no-op otherwise,
 * which only loses the tracking, not the text).
 */
export function track(textObj, px) {
  if (typeof textObj.setLetterSpacing === 'function') textObj.setLetterSpacing(px);
  return textObj;
}
