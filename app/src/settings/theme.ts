// Applies the theme and accent from Settings to the page (data-theme and
// data-accent and data-palette on <html>; the colors themselves are CSS variables in
// index.css). The PixiJS table can't use CSS, so it reads the same variables
// through tableColors() and listens for THEME_EVENT to redraw.
import { useSettings, type ThemeChoice } from './settingsStore';

export const THEME_EVENT = 'table-theme-change';

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

/** The theme actually showing ('system' resolved). */
export function resolvedTheme(choice: ThemeChoice = useSettings.getState().theme): 'dark' | 'light' {
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
