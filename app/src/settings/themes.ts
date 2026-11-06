// Preset color themes, the same set as Umbra's (OLED, Nord, Gruvbox, ...).
// A theme picks seven colors; every CSS variable the app uses is worked out
// from them in themeVars(), so adding a theme is one line.

export interface ThemePreset {
  key: string;
  name: string;
  background: string; // the table
  surface: string; // sidebar
  card: string; // side panels, dialogs, bubbles
  control: string; // buttons, inputs, lines
  text: string;
  textDim: string;
  accent: string;
  light?: boolean;
}

export const THEME_PRESETS: ThemePreset[] = [
  { key: 'oled', name: 'OLED', background: '#000000', surface: '#0b0b0b', card: '#101010', control: '#141414', text: '#c8c8c8', textDim: '#8a8a8a', accent: '#c8c8c8' },
  { key: 'graphite', name: 'Graphite', background: '#1c1c1e', surface: '#2c2c2e', card: '#242426', control: '#323234', text: '#e5e5e7', textDim: '#98989d', accent: '#0a84ff' },
  { key: 'nord', name: 'Nord', background: '#2e3440', surface: '#3b4252', card: '#3b4252', control: '#434c5e', text: '#eceff4', textDim: '#a3abb9', accent: '#88c0d0' },
  { key: 'gruvbox', name: 'Gruvbox', background: '#282828', surface: '#32302f', card: '#32302f', control: '#3c3836', text: '#ebdbb2', textDim: '#a89984', accent: '#fe8019' },
  { key: 'rosePine', name: 'Rosé Pine', background: '#191724', surface: '#1f1d2e', card: '#1f1d2e', control: '#26233a', text: '#e0def4', textDim: '#908caa', accent: '#c4a7e7' },
  { key: 'catppuccin', name: 'Catppuccin', background: '#1e1e2e', surface: '#181825', card: '#26263a', control: '#313244', text: '#cdd6f4', textDim: '#a6adc8', accent: '#cba6f7' },
  { key: 'dracula', name: 'Dracula', background: '#282a36', surface: '#21222c', card: '#2f3241', control: '#44475a', text: '#f8f8f2', textDim: '#a0a3ba', accent: '#bd93f9' },
  { key: 'tokyoNight', name: 'Tokyo Night', background: '#1a1b26', surface: '#16161e', card: '#1f2335', control: '#292e42', text: '#c0caf5', textDim: '#7e83a6', accent: '#7aa2f7' },
  { key: 'sageNight', name: 'Sage Night', background: '#1f2620', surface: '#262e27', card: '#2a332b', control: '#343e35', text: '#dde6d8', textDim: '#98a693', accent: '#a3c29a' },
  { key: 'lavenderNight', name: 'Lavender Night', background: '#221f2b', surface: '#2a2634', card: '#2e2a39', control: '#3a3547', text: '#e6e0f2', textDim: '#a39db4', accent: '#b8a4e3' },
  { key: 'light', name: 'Light', background: '#f2f2f4', surface: '#ffffff', card: '#ffffff', control: '#e4e4e9', text: '#1d1d1f', textDim: '#6e6e73', accent: '#007aff', light: true },
  { key: 'sage', name: 'Sage', background: '#e3eadf', surface: '#f2f5ef', card: '#f2f5ef', control: '#d3ddcd', text: '#2f3a2c', textDim: '#6b7a66', accent: '#7c9a6e', light: true },
  { key: 'mint', name: 'Mint', background: '#dff2ea', surface: '#f1faf6', card: '#f1faf6', control: '#cbe6da', text: '#21362d', textDim: '#5f7d70', accent: '#4faf8e', light: true },
  { key: 'sky', name: 'Sky', background: '#e2edf5', surface: '#f3f8fb', card: '#f3f8fb', control: '#d2e1ec', text: '#233340', textDim: '#627584', accent: '#6fa3c8', light: true },
  { key: 'lavender', name: 'Lavender', background: '#ece7f4', surface: '#f7f4fb', card: '#f7f4fb', control: '#ddd5ea', text: '#2e2838', textDim: '#72697f', accent: '#9c86c9', light: true },
  { key: 'blush', name: 'Blush', background: '#f5e6e8', surface: '#fcf4f5', card: '#fcf4f5', control: '#ebd6d9', text: '#3a2a2d', textDim: '#85696e', accent: '#d4889a', light: true },
  { key: 'peach', name: 'Peach', background: '#f7e4d9', surface: '#fcf2ec', card: '#fcf2ec', control: '#eed2c3', text: '#3b2a22', textDim: '#86695b', accent: '#e0916a', light: true },
  { key: 'butter', name: 'Butter', background: '#f5efd9', surface: '#fbf8ec', card: '#fbf8ec', control: '#eae1c4', text: '#3a3424', textDim: '#80775c', accent: '#c99a3e', light: true },
];

export const themePreset = (key: string): ThemePreset | undefined => THEME_PRESETS.find((t) => t.key === key);

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
/** Blend: t = 0 gives a, t = 1 gives b. */
const mix = (a: string, b: string, t: number) => {
  const x = rgb(a);
  const y = rgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
};
const luma = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** The app's CSS variables for a preset (index.css lists what each one is for). */
export function themeVars(t: ThemePreset): Record<string, string> {
  return {
    '--table-bg': t.background,
    '--rail': t.surface,
    '--panel': t.card,
    '--line': t.control,
    '--panel-text': t.text,
    '--muted': t.textDim,
    '--input': t.light ? mix(t.card, '#ffffff', 0.5) : mix(t.background, '#000000', 0.15),
    '--input-line': mix(t.control, t.text, 0.15),
    '--accent': t.accent,
    '--on-accent': luma(t.accent) > 150 ? '#101010' : '#ffffff',
    '--grid-dot': mix(t.background, t.text, t.light ? 0.16 : 0.13),
    '--fence-line': mix(t.background, t.textDim, 0.7),
    '--bubble-shadow': t.light ? '0 4px 16px rgba(0, 0, 0, 0.18)' : '0 4px 16px rgba(0, 0, 0, 0.45)',
  };
}

export const THEME_VAR_NAMES = Object.keys(themeVars(THEME_PRESETS[0]));
