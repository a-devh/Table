import { BoxIcon, ExitIcon, GearIcon, MoonIcon, SearchIcon, StarIcon, SunIcon } from './icons';
import { useSettings } from '../settings/settingsStore';
import { resolvedTheme } from '../settings/theme';
import { useState } from 'react';
import { SettingsDialog } from '../settings/SettingsDialog';
import styles from './NavigationBar.module.css';

export type ModuleName = 'search' | 'favorites' | 'collection';

interface Props {
  open: ModuleName | null;
  onToggle: (m: ModuleName) => void;
}

const items: { name: ModuleName; label: string; Icon: () => React.JSX.Element }[] = [
  { name: 'search', label: 'Search', Icon: SearchIcon },
  { name: 'favorites', label: 'Favorites', Icon: StarIcon },
  { name: 'collection', label: 'Collection', Icon: BoxIcon },
];

export function NavigationBar({ open, onToggle }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const theme = resolvedTheme(useSettings((s) => s.theme));
  return (
    <nav aria-label="Panels" className={styles.rail}>
      {items.map(({ name, label, Icon }) => (
        <button
          key={name}
          aria-label={label}
          aria-pressed={open === name}
          className={styles.item}
          onClick={() => onToggle(name)}
        >
          <Icon />
        </button>
      ))}
      <div className={styles.spacer} />
      {/* Quick dark / light switch; accent colors and "follow system" are in Settings. */}
      <button
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
        className={styles.item}
        onClick={() => useSettings.getState().setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
      <button aria-label="Settings" aria-pressed={settingsOpen} className={styles.item} onClick={() => setSettingsOpen(true)}>
        <GearIcon />
      </button>
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      <button aria-label="Exit" className={styles.item} onClick={() => window.close()}>
        <ExitIcon />
      </button>
    </nav>
  );
}
