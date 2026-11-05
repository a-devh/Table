import { useEffect } from 'react';
import { useTable } from '../model/store';
import { GridIcon, HandIcon, PencilIcon } from '../app/icons';
import { useSettings } from '../settings/settingsStore';
import ui from '../app/ui.module.css';

export function ToolSelector() {
  const tool = useTable((s) => s.activeTool);
  const setTool = useTable((s) => s.setTool);
  const gridSnap = useSettings((s) => s.gridSnap);

  // Optional shortcuts: H = Hand, P = Pencil, G = grid snapping on/off (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'h' || e.key === 'H') setTool('hand');
      if (e.key === 'p' || e.key === 'P') setTool(useTable.getState().activeTool === 'pencil' ? 'hand' : 'pencil');
      if (e.key === 'g' || e.key === 'G') useSettings.getState().setGridSnap(!useSettings.getState().gridSnap);
    };
    // Holding Ctrl switches to the Pencil until it's released, so the toolbar
    // shows what a drag will do.
    let springLoaded = false;
    const onCtrlDown = (e: KeyboardEvent) => {
      if (e.key !== 'Control' || e.repeat || useTable.getState().activeTool !== 'hand') return;
      springLoaded = true;
      setTool('pencil');
    };
    const release = () => {
      if (!springLoaded) return;
      springLoaded = false;
      setTool('hand');
    };
    const onCtrlUp = (e: KeyboardEvent) => e.key === 'Control' && release();
    window.addEventListener('keydown', onKey);
    window.addEventListener('keydown', onCtrlDown);
    window.addEventListener('keyup', onCtrlUp);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keydown', onCtrlDown);
      window.removeEventListener('keyup', onCtrlUp);
      window.removeEventListener('blur', release);
    };
  }, [setTool]);

  return (
    <div role="toolbar" aria-label="Tools" className={ui.bubbleBottom}>
      <button aria-label="Hand: move cards and pan" aria-pressed={tool === 'hand'} className={ui.iconButton} onClick={() => setTool('hand')}>
        <HandIcon />
      </button>
      <button
        aria-label="Pencil: draw a fence"
        aria-pressed={tool === 'pencil'}
        className={ui.iconButton}
        onClick={() => setTool(tool === 'pencil' ? 'hand' : 'pencil')}
      >
        <PencilIcon />
      </button>
      <span className={ui.divider} />
      <button
        aria-label={gridSnap ? 'Snap to grid is on (G)' : 'Snap to grid is off (G)'}
        title={gridSnap ? 'Snap to grid: on (G). Alt while dragging places freely.' : 'Snap to grid: off (G)'}
        aria-pressed={gridSnap}
        className={ui.iconButton}
        onClick={() => useSettings.getState().setGridSnap(!gridSnap)}
      >
        <GridIcon />
      </button>
    </div>
  );
}
