// Applies the theme from Settings to the page: data-theme, data-accent and
// data-palette on <html>, plus a preset theme's colors as inline CSS variables
// (Table's own colors are in index.css). The PixiJS table can't use CSS, so it
// reads the same variables through tableColors() and listens for THEME_EVENT to redraw.
import { useSettings, type ThemeChoice } from './settingsStore';
import { THEME_VAR_NAMES, themePreset, themeVars } from './themes';

export const THEME_EVENT = 'table-theme-change';

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

/** The theme actually showing: a preset's own lightness, or Table's Theme setting ('system' resolved). */
export function resolvedTheme(choice: ThemeChoice = useSettings.getState().theme): 'dark' | 'light' {
  const preset = themePreset(useSettings.getState().palette);
  if (preset) return preset.light ? 'light' : 'dark';
  return choice === 'system' ? (systemDark.matches ? 'dark' : 'light') : choice;
}

function apply() {
  const { accent, palette } = useSettings.getState();
  const root = document.documentElement;
  const theme = resolvedTheme();
  if (root.dataset.theme === theme && root.dataset.accent === accent && root.dataset.palette === palette) return;
  root.dataset.theme = theme;
  root.dataset.accent = accent;
  root.dataset.palette = palette;
  // A preset theme sets every color variable on <html>; Table's own colors come from index.css.
  const preset = themePreset(palette);
  for (const name of THEME_VAR_NAMES) root.style.removeProperty(name);
  if (preset) {
    for (const [name, value] of Object.entries(themeVars(preset))) {
      // A chosen accent (not "default") keeps winning over the preset's.
      if ((name === '--accent' || name === '--on-accent') && accent !== 'default') continue;
      root.style.setProperty(name, value);
    }
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function startTheme() {
  apply();
  useSettings.subscribe(apply);
  systemDark.addEventListener('change', apply);
}

const hex = (name: string, fallback: number) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return /^#[0-9a-f]{6}$/i.test(v) ? parseInt(v.slice(1), 16) : fallback;
};

/** Theme colors for the PixiJS table. */
export function tableColors() {
  return {
    accent: hex('--accent', 0x7aa7ff),
    onAccent: hex('--on-accent', 0x0b0c0e),
    fenceLine: hex('--fence-line', 0x5a5d66),
    fenceLabel: hex('--muted', 0x9a9ca3),
    tableBg: hex('--table-bg', 0x121316),
  };
}
