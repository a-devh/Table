import type { ModuleName } from './NavigationBar';
import { SearchModule } from '../search/SearchModule';
import { FavoritesModule } from '../favorites/FavoritesModule';
import { CollectionModule } from '../collection/CollectionModule';
import { PANEL_WIDTH, useSettings } from '../settings/settingsStore';
import styles from './Modules.module.css';

export function Modules({ module }: { module: ModuleName }) {
  const width = useSettings((s) => s.searchLayout.panelWidth);

  // Drag the panel's right edge to make it wider or narrower.
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = width;
    const move = (ev: PointerEvent) => {
      const w = Math.min(PANEL_WIDTH.max, Math.max(PANEL_WIDTH.min, w0 + ev.clientX - x0));
      useSettings.getState().setSearchLayout({ panelWidth: w });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = 'ew-resize';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <section aria-label={module} className={styles.panel} style={{ width }} data-remove-drop={module}>
      <div className={styles.resize} role="separator" aria-orientation="vertical" aria-label="Resize panel" onPointerDown={startResize} />
      {module === 'search' && <SearchModule />}
      {module === 'favorites' && <FavoritesModule />}
      {module === 'collection' && <CollectionModule />}
    </section>
  );
}
