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
import { useDeleteKey } from './cardMenuStore';
import { useClipboardKeys } from './clipboard';

export function Board() {
  const hostRef = useRef<HTMLDivElement>(null);
  useDeleteKey();
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

    return () => {
      cancelled = true;
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
          backgroundImage: 'radial-gradient(circle, var(--grid-dot) 1.8px, transparent 2.3px)',
        }}
      />
      <CardMenu />
      <MergedPeek />
    </>
  );
}
