// Top of the component hierarchy (see docs/design.md).
import { useEffect, useState } from 'react';
import { isPhone, PANEL_DRAG_END } from './device';
import { NavigationBar, type ModuleName } from './NavigationBar';
import { Modules } from './Modules';
import { Board } from '../board/Board';
import { TagPane } from '../tags/TagPane';
import { FenceOverlay } from '../fences/FenceOverlay';
import { SectionPicker } from '../fences/SectionPicker';
import { ToolSelector } from '../tools/ToolSelector';
import { UtilityBar } from '../utility/UtilityBar';
import { ViewController } from '../board/ViewController';
import { HistoryControls } from '../history/HistoryControls';
import styles from './Container.module.css';

export function Container() {
  // Phones start on the table; a panel there covers the whole screen.
  const [openModule, setOpenModule] = useState<ModuleName | null>(() => (isPhone() ? null : 'search'));

  // Phone: after a card is pulled out of a panel onto the table, stay on the table.
  useEffect(() => {
    const onDragEnd = () => isPhone() && setOpenModule(null);
    window.addEventListener(PANEL_DRAG_END, onDragEnd);
    return () => window.removeEventListener(PANEL_DRAG_END, onDragEnd);
  }, []);

  return (
    <div className={styles.container}>
      <NavigationBar
        open={openModule}
        onToggle={(m) => setOpenModule((cur) => (cur === m ? null : m))}
        onClose={() => setOpenModule(null)}
      />
      {openModule && <Modules module={openModule} />}
      <main className={styles.board}>
        <Board />
        <FenceOverlay />
        <TagPane />
        <div className={styles.bottomBubbles}>
          <ToolSelector />
          <UtilityBar />
          <HistoryControls />
          <ViewController />
        </div>
        <SectionPicker />
      </main>
    </div>
  );
}
