// Top of the component hierarchy (see docs/design.md).
import { useState } from 'react';
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
  const [openModule, setOpenModule] = useState<ModuleName | null>('search');

  return (
    <div className={styles.container}>
      <NavigationBar
        open={openModule}
        onToggle={(m) => setOpenModule((cur) => (cur === m ? null : m))}
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
