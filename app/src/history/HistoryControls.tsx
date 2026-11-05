// Undo/redo bubble next to the zoom controls, plus Ctrl+Z / Ctrl+Shift+Z
// (Ctrl+Y also redoes). Text fields keep their own undo.
import { useEffect } from 'react';
import { RedoIcon, UndoIcon } from '../app/icons';
import { redo, undo, useHistory } from './history';
import ui from '../app/ui.module.css';

export function HistoryControls() {
  const canUndo = useHistory((h) => h.past.length > 0);
  const canRedo = useHistory((h) => h.future.length > 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if ((e.target as HTMLElement).closest('input, textarea, [contenteditable]')) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) undo();
      else if ((key === 'z' && e.shiftKey) || key === 'y') redo();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div role="toolbar" aria-label="History" className={ui.bubbleBottom}>
      <button aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)" className={ui.iconButton} disabled={!canUndo} onClick={undo}>
        <UndoIcon />
      </button>
      <button aria-label="Redo (Ctrl+Shift+Z)" title="Redo (Ctrl+Shift+Z)" className={ui.iconButton} disabled={!canRedo} onClick={redo}>
        <RedoIcon />
      </button>
    </div>
  );
}
