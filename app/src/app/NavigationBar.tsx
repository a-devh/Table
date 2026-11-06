import { BoxIcon, ExitIcon, GearIcon, MoonIcon, SearchIcon, StarIcon, SunIcon, TableIcon } from './icons';
import { usePhone } from './device';
import { useSettings } from '../settings/settingsStore';
import { resolvedTheme } from '../settings/theme';
import { useState } from 'react';
import { SettingsDialog } from '../settings/SettingsDialog';
import styles from './NavigationBar.module.css';

export type ModuleName = 'search' | 'favorites' | 'collection';

interface Props {
  open: ModuleName | null;
  onToggle: (m: ModuleName) => void;
  /** Close the open panel (the phone's Table tab). */
  onClose: () => void;
}

const items: { name: ModuleName; label: string; Icon: () => React.JSX.Element }[] = [
  { name: 'search', label: 'Search', Icon: SearchIcon },
  { name: 'favorites', label: 'Favorites', Icon: StarIcon },
  { name: 'collection', label: 'Collection', Icon: BoxIcon },
];

export function NavigationBar({ open, onToggle, onClose }: Props) {
  const phone = usePhone();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const choice = useSettings((s) => s.theme);
  useSettings((s) => s.palette); // a preset theme decides dark or light itself
  const theme = resolvedTheme(choice);
  return (
    <nav aria-label="Panels" className={styles.rail}>
      {/* Phone: panels cover the table, so the table gets a tab of its own. */}
      {phone && (
        <button aria-label="Table" aria-pressed={open === null} className={styles.item} onClick={onClose}>
          <TableIcon />
        </button>
      )}
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
      {/* Quick dark / light switch (back to Table's own colors if a preset theme is on); presets, accents and "follow system" are in Settings. */}
      <button
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
        className={styles.item}
        onClick={() => {
          const s = useSettings.getState();
          s.setPalette('table');
          s.setTheme(theme === 'dark' ? 'light' : 'dark');
        }}
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
      <button aria-label="Settings" aria-pressed={settingsOpen} className={styles.item} onClick={() => setSettingsOpen(true)}>
        <GearIcon />
      </button>
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {!phone && (
        <button aria-label="Exit" className={styles.item} onClick={() => window.close()}>
          <ExitIcon />
        </button>
      )}
    </nav>
  );
}
