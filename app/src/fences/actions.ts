// Fence behaviour that combines the layout rules with table actions.
import { useTable } from '../model/store';
import { CARD_HEIGHT, CARD_WIDTH, cardsInFence, groupShown } from '../model/derived';
import type { FenceView, Point, Rect, TableCard } from '../model/types';
import { FENCE_PAD, fitFence, frameOf, layoutFence } from './layout';

const padded = (r: Rect): Rect => ({ x: r.x - FENCE_PAD, y: r.y - FENCE_PAD, width: r.width + 2 * FENCE_PAD, height: r.height + 2 * FENCE_PAD });

export function applyFenceView(fenceId: string, view: FenceView) {
  const t = useTable.getState();
  const fence = t.fences[fenceId];
  if (!fence) return;
  // Sorted views lay out from the frame's corner, so the fence can shrink back to it.
  const { x, y } = frameOf(fence);
  const layout = view === 'custom' ? null : layoutFence({ ...fence, x, y, view }, cardsInFence(t, fenceId), t.tags);
  t.setFenceView(fenceId, view, layout);
  settleFences();
}

/**
 * Run after cards are dropped or let go. Sorted fences slot cards into their
 * columns; every open fence grows or shrinks to keep a one-cell padding around
 * its cards (never smaller than the frame the user drew).
 */
export function settleFences() {
  const t = useTable.getState();
  const positions: Record<string, Point> = {};
  const rects: Record<string, Rect> = {};
  const fences = Object.values(t.fences);
  // Groups first: their fence then fits around them (with padding).
  for (const group of fences) {
    if (group.parentId && groupShown(group, t.fences)) rects[group.id] = fitFence(group, cardsInFence(t, group.id));
  }
  for (const fence of fences) {
    if (fence.stacked || fence.parentId) continue;
    const members = cardsInFence(t, fence.id);
    if (fence.view === 'custom') {
      const groups = fences.filter((g) => g.parentId === fence.id).map((g) => padded(rects[g.id] ?? g));
      rects[fence.id] = fitFence(fence, members, groups);
    } else {
      const { x, y } = frameOf(fence);
      const layout = layoutFence({ ...fence, x, y }, members, t.tags);
      Object.assign(positions, layout.positions);
      rects[fence.id] = fitFence(fence, [], [{ x, y, width: layout.width, height: layout.height }]);
    }
  }
  t.placeCards(positions, rects);
}

/**
 * Live fit while cards are dragged: a fence grows as a dragged card nears its
 * edge and shrinks back as it moves away. A dragged card counts as inside
 * while its center is within the fence as it was without the dragged cards,
 * so dragging on past that edge takes the card out (the fence lets go of it).
 */
let live: { fenceId: string; base: Rect; still: TableCard[] }[] = [];
let liveIds = new Set<string>();

export function startLiveFit(draggedIds: string[]) {
  const t = useTable.getState();
  liveIds = new Set(draggedIds);
  live = Object.values(t.fences)
    .filter((f) => !f.stacked && f.view === 'custom' && (!f.parentId || groupShown(f, t.fences)))
    .map((f) => {
      const still = cardsInFence(t, f.id).filter((c) => !liveIds.has(c.id));
      return { fenceId: f.id, base: fitFence(f, still), still };
    });
}

export function liveFit() {
  if (!live.length) return;
  const t = useTable.getState();
  const dragged = [...liveIds].map((id) => t.cards[id]).filter(Boolean);
  const rects: Record<string, Rect> = {};
  for (const { fenceId, base, still } of live) {
    const fence = t.fences[fenceId];
    if (!fence) continue;
    const inside = dragged.filter((c) => {
      const cx = c.x + CARD_WIDTH / 2;
      const cy = c.y + CARD_HEIGHT / 2;
      return cx >= base.x && cx <= base.x + base.width && cy >= base.y && cy <= base.y + base.height;
    });
    const r = fitFence(fence, [...still, ...inside]);
    if (r.x !== fence.x || r.y !== fence.y || r.width !== fence.width || r.height !== fence.height) rects[fenceId] = r;
  }
  if (Object.keys(rects).length) t.placeCards({}, rects);
}

export function endLiveFit() {
  live = [];
  liveIds = new Set();
}
