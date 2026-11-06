// The infinite table, drawn with PixiJS. React only mounts the canvas; the
// scene is kept in sync with the shared table state by `TableScene`.
import { useEffect, useRef } from 'react';
import { Application } from 'pixi.js';
import { TableScene } from './TableScene';
import { useTable } from '../model/store';
import { cardAt } from '../model/derived';
import { TAG_DRAG_TYPE } from './dragTypes';
import { settleFences } from '../fences/actions';
import { CardMenu } from './CardMenu';
import { MergedPeek } from './MergedPeek';
import { useDeleteKey, useFlipKey } from './cardMenuStore';
import { useClipboardKeys } from './clipboard';
import { useSettings, type GridPattern } from '../settings/settingsStore';

/**
 * The snap grid's look (Settings > Table). Each tile is one grid cell with its
 * grid point in the middle; TableScene sizes and shifts the tiles with the camera.
 */
const LINE = 'color-mix(in srgb, var(--grid-dot) 55%, transparent)';
const GRID_IMAGES: Record<GridPattern, string> = {
  dots: 'radial-gradient(circle, var(--grid-dot) 1.3px, transparent 1.8px)',
  fine: 'radial-gradient(circle, var(--grid-dot) 0.7px, transparent 1.2px)',
  lines: [
    `linear-gradient(to bottom, transparent calc(50% - 0.5px), ${LINE} calc(50% - 0.5px), ${LINE} calc(50% + 0.5px), transparent calc(50% + 0.5px))`,
    `linear-gradient(to right, transparent calc(50% - 0.5px), ${LINE} calc(50% - 0.5px), ${LINE} calc(50% + 0.5px), transparent calc(50% + 0.5px))`,
  ].join(', '),
  none: 'none',
};

export function Board() {
  const hostRef = useRef<HTMLDivElement>(null);
  const gridPattern = useSettings((s) => s.gridPattern);
  useDeleteKey();
  useFlipKey();
  useClipboardKeys();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let scene: TableScene | undefined;
    const app = new Application();

    app
      .init({
        resizeTo: host,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      })
      .then(() => {
        if (cancelled) {
          app.destroy(true);
          return;
        }
        host.appendChild(app.canvas);
        scene = new TableScene(app, host);
      });
    // Pixi only follows window resizes; the table also changes size when a side panel opens or closes.
    const observer = new ResizeObserver(() => app.renderer && app.resize());
    observer.observe(host);

    return () => {
      cancelled = true;
      observer.disconnect();
      scene?.destroy();
      if (app.renderer) app.destroy(true, { children: true });
    };
  }, []);

  const toWorld = (e: React.DragEvent) => {
    const rect = hostRef.current!.getBoundingClientRect();
    const { x, y, zoom } = useTable.getState().camera;
    return {
      x: (e.clientX - rect.left - x) / zoom,
      y: (e.clientY - rect.top - y) / zoom,
    };
  };

  const onDragOver = (e: React.DragEvent) => {
    const types = e.dataTransfer.types;
    if (types.includes(TAG_DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const onDrop = (e: React.DragEvent) => {
    const tagId = e.dataTransfer.getData(TAG_DRAG_TYPE);
    const p = toWorld(e);
    const t = useTable.getState();
    if (tagId) {
      e.preventDefault();
      const target = cardAt(t, p.x, p.y);
      if (target) {
        t.tagCard(target.id, tagId);
        settleFences();
      }
    }
  };

  return (
    <>
      <div
        id="board"
        ref={hostRef}
        onDragOver={onDragOver}
        onDrop={onDrop}
        style={{
          position: 'absolute',
          inset: 0,
          // Size and position follow the camera (set by TableScene).
          backgroundImage: GRID_IMAGES[gridPattern],
        }}
      />
      <CardMenu />
      <MergedPeek />
    </>
  );
}
