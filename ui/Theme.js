/**
 * Theme — shared colors and text styles so every scene looks consistent.
 * Visuals are deliberately minimal (placeholder art); the theme keeps them tidy.
 */

export const Colors = {
  bg: 0x0b0c10,
  panel: 0x14161d,
  panelEdge: 0x3a3f4f,
  accent: 0xd8b36a,        // candle-gold
  accentDim: 0x8a7340,
  danger: 0xc4554d,
  good: 0x6dbb6d,
  focus: 0x5d9fd4,
  text: '#e8e4d8',
  textDim: '#9a958a',
  speaker: '#d8b36a',
  voice: '#8fb8d8',        // skill "voice" commentary
  check: '#c9a0dc',
  disabled: '#5a564e',
};

export const Fonts = {
  body: 'Georgia, "Times New Roman", serif',
  ui: 'Verdana, Geneva, sans-serif',
};

/** @returns {object} Phaser text style */
export function bodyStyle(overrides = {}) {
  return { fontFamily: Fonts.body, fontSize: '34px', color: Colors.text, lineSpacing: 12, ...overrides };
}

/** @returns {object} Phaser text style */
export function uiStyle(overrides = {}) {
  return { fontFamily: Fonts.ui, fontSize: '28px', color: Colors.text, ...overrides };
}

/** @returns {object} Phaser text style */
export function titleStyle(overrides = {}) {
  return { fontFamily: Fonts.body, fontSize: '84px', color: '#e8e4d8', fontStyle: 'bold', ...overrides };
}
