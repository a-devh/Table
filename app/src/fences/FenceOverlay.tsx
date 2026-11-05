// Screen-space parts of each fence: the floating name (drag it to move the
// fence and its cards), hover options, and the resize corner. They follow the
// camera but stay a constant size.
//
// Panning moves one inner layer directly (no React re-render), so fast pans
// stay smooth. Positions inside the layer only depend on zoom.
import { useEffect, useRef, useState } from 'react';
import { useTable } from '../model/store';
import { cardsInFence, groupShown, mergeCount } from '../model/derived';
import type { Fence, FenceView } from '../model/types';
import { useFenceUi } from './uiStore';
import { applyFenceView, settleFences } from './actions';
import { AnalyticsPanel } from './AnalyticsPanel';
import { ANALYTICS_SECTIONS, type AnalyticsSection } from './uiStore';
import { useDeckCheck } from '../formats/deckCheckStore';
import { snapToGrid } from '../board/snapping';
import styles from './fences.module.css';

const VIEWS: { value: FenceView; label: string }[] = [
  { value: 'custom', label: 'Custom' },
  { value: 'cmc', label: 'CMC' },
  { value: 'type', label: 'Type' },
  { value: 'color', label: 'Color' },
  { value: 'rarity', label: 'Rarity' },
  { value: 'set', label: 'Set' },
  { value: 'tags', label: 'Tags' },
];

const MIN_SIZE = 120;

/** Follow a pointer drag with window listeners; reports total movement in screen pixels since the press. */
function trackDrag(e: React.PointerEvent, onMove: (totalX: number, totalY: number, alt: boolean) => void, onEnd?: () => void) {
  e.preventDefault();
  e.stopPropagation();
  const x0 = e.clientX;
  const y0 = e.clientY;
  const move = (ev: PointerEvent) => onMove(ev.clientX - x0, ev.clientY - y0, ev.altKey);
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    onEnd?.();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

export function FenceOverlay() {
  const fences = useTable((s) => s.fences);
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const place = (x: number, y: number) => {
      if (layer.current) layer.current.style.transform = `translate(${x}px, ${y}px)`;
    };
    const { x, y } = useTable.getState().camera;
    place(x, y);
    return useTable.subscribe((s, prev) => s.camera !== prev.camera && place(s.camera.x, s.camera.y));
  }, []);
  return (
    <div className={styles.overlay}>
      <div ref={layer} className={styles.cameraLayer}>
        {Object.values(fences)
          .filter((f) => !f.parentId || groupShown(f, fences))
          .map((f) => (
            <FenceHeader key={f.id} fence={f} />
          ))}
      </div>
    </div>
  );
}

function FenceHeader({ fence }: { fence: Fence }) {
  const zoom = useTable((s) => s.camera.zoom);
  // Recounted only when cards or fences change, not on every camera move.
  const cards = useTable((s) => s.cards);
  const fences = useTable((s) => s.fences);
  const count = cardsInFence({ ...useTable.getState(), cards, fences }, fence.id).reduce((n, c) => n + mergeCount(c), 0);
  // The zone's total across all its fences, against the format's count.
  const isGroup = !!fence.parentId;
  const zone = useDeckCheck((s) => (isGroup ? undefined : s.zones.find((z) => z.zone === fence.section)));
  const [renaming, setRenaming] = useState(false);
  const hoveredOnTable = useFenceUi((s) => s.hoveredFenceId === fence.id);
  const [hoveredHeader, setHoveredHeader] = useState(false);
  const [hoveredPanel, setHoveredPanel] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const showOptions = hoveredOnTable || hoveredHeader || menuOpen;
  const openSection = useFenceUi((s) => s.analytics[fence.id]);
  const section: AnalyticsSection | undefined = openSection ?? (fence.analyticsPinned ? 'all' : undefined);

  // An unpinned panel closes shortly after the pointer leaves the fence and the panel.
  const keepOpen = fence.analyticsPinned || showOptions || hoveredPanel;
  useEffect(() => {
    if (!openSection || keepOpen) return;
    const timer = window.setTimeout(() => useFenceUi.getState().closeAnalytics(fence.id), 400);
    return () => window.clearTimeout(timer);
  }, [openSection, keepOpen, fence.id]);

  // Relative to the camera layer, which is shifted by the pan.
  const left = fence.x * zoom;
  const top = fence.y * zoom;
  const right = left + fence.width * zoom;
  const bottom = top + fence.height * zoom;

  const startMove = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // Membership is decided once at the start, by card center points.
    const ids = cardsInFence(useTable.getState(), fence.id).map((c) => c.id);
    const { x: fx, y: fy } = fence;
    trackDrag(
      e,
      (tx, ty, alt) => {
        const t = useTable.getState();
        const f = t.fences[fence.id];
        if (!f) return;
        // The fence's corner follows the pointer on the grid; its cards move with it.
        const x = snapToGrid(fx + tx / t.camera.zoom, alt);
        const y = snapToGrid(fy + ty / t.camera.zoom, alt);
        t.moveFence(fence.id, x - f.x, y - f.y, ids);
      },
      settleFences,
    ); // Cards it was dropped onto now count as its own.
  };

  const startResize = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const { width: w0, height: h0 } = fence;
    trackDrag(
      e,
      (tx, ty, alt) => {
        const t = useTable.getState();
        const f = t.fences[fence.id];
        if (!f) return;
        // The bottom-right corner lands on the grid.
        const right = snapToGrid(f.x + w0 + tx / t.camera.zoom, alt);
        const bottom = snapToGrid(f.y + h0 + ty / t.camera.zoom, alt);
        t.resizeFence(f.id, Math.max(MIN_SIZE, right - f.x), Math.max(MIN_SIZE, bottom - f.y));
      },
      settleFences,
    ); // Sized smaller than its cards, the fence fits back around them.
  };

  const t = useTable.getState();
  return (
    <>
      <div
        className={styles.header}
        data-group={isGroup || undefined}
        style={{ left, top: top - 34 }}
        onPointerEnter={() => setHoveredHeader(true)}
        onPointerLeave={() => setHoveredHeader(false)}
      >
        {renaming ? (
          <input
            autoFocus
            aria-label="Group name"
            className={styles.rename}
            defaultValue={fence.name}
            onBlur={(e) => {
              if (e.target.value.trim()) t.renameFence(fence.id, e.target.value.trim());
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setRenaming(false);
            }}
          />
        ) : (
          <span
            className={styles.name}
            title={isGroup ? 'Drag to move the group and its cards. Double-click to rename.' : 'Drag to move the fence and its cards'}
            onPointerDown={startMove}
            onDoubleClick={() => isGroup && setRenaming(true)}
          >
            {fence.name}
          </span>
        )}
        {zone ? (
          <span
            className={styles.count}
            data-bad={!zone.ok || undefined}
            title={`${fence.section}: ${zone.count} cards, needs ${zone.rule} ${zone.target}${zone.count !== count ? ` (${count} in this fence)` : ''}`}
          >
            {zone.count} / {zone.target}
          </span>
        ) : (
          <span className={styles.count}>{count}</span>
        )}
        {showOptions && (
          <span className={styles.options}>
            {!isGroup && (
              <>
                <label>
                  <span className={styles.optionLabel}>View</span>
                  <select
                    aria-label={`${fence.name} view`}
                    className={styles.select}
                    value={fence.view}
                    disabled={fence.stacked}
                    onChange={(e) => applyFenceView(fence.id, e.target.value as FenceView)}
                  >
                    {VIEWS.map((v) => (
                      <option key={v.value} value={v.value}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </label>
                <select
                  aria-label={`${fence.name} analytics`}
                  className={styles.select}
                  value=""
                  onChange={(e) => useFenceUi.getState().openAnalytics(fence.id, e.target.value as AnalyticsSection)}
                >
                  <option value="" disabled>
                    Analytics
                  </option>
                  {ANALYTICS_SECTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button className={styles.optionButton} onClick={() => (fence.stacked ? t.unstackFence(fence.id) : t.stackFence(fence.id))}>
                  {fence.stacked ? 'Unstack' : 'Stack'}
                </button>
              </>
            )}
            <span className={styles.menuWrap}>
              <button
                className={styles.optionButton}
                aria-label={`More options for ${fence.name}`}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
              >
                ⋯
              </button>
              {menuOpen && (
                <span role="menu" className={styles.menu} onPointerLeave={() => setMenuOpen(false)}>
                  <button
                    role="menuitem"
                    className={styles.menuItem}
                    disabled={count === 0}
                    onClick={() => {
                      const s = useTable.getState();
                      s.removeCards(cardsInFence(s, fence.id).map((c) => c.id));
                      setMenuOpen(false);
                    }}
                  >
                    Empty{count ? ` (remove ${count} card${count === 1 ? '' : 's'})` : ''}
                  </button>
                  <button
                    role="menuitem"
                    className={styles.menuItem}
                    onClick={() => {
                      // Unstack first so the cards aren't left in a face-down pile.
                      if (fence.stacked) t.unstackFence(fence.id);
                      useFenceUi.getState().closeAnalytics(fence.id);
                      useTable.getState().removeFence(fence.id);
                    }}
                  >
                    {isGroup ? 'Delete group (keep cards)' : 'Delete fence (keep cards)'}
                  </button>
                </span>
              )}
            </span>
          </span>
        )}
      </div>
      {section && <AnalyticsPanel fence={fence} section={section} onHover={setHoveredPanel} />}
      {!fence.stacked && (
        <div aria-label={`Resize ${fence.name}`} className={styles.resize} style={{ left: right - 10, top: bottom - 10 }} onPointerDown={startResize} />
      )}
    </>
  );
}
