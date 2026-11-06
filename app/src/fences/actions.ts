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
 * edge and shrinks back as it moves away. Whether a card stays in is about
 * momentum: dragged slowly it holds on and the fence keeps growing to follow
 * it; flicked out fast, the fence lets go. A card comes in when its center
 * enters the fence as it was without the dragged cards.
 */
let live: { fenceId: string; base: Rect; still: TableCard[]; held: Set<string> }[] = [];
let liveIds = new Set<string>();
/** Pointer speed (screen px per ms, smoothed) above which a card leaves the fence it's held by. */
const LET_GO_SPEED = 0.9;
let motion: { x: number; y: number; t: number; speed: number } | null = null;

const centerIn = (c: TableCard, r: Rect) => {
  const cx = c.x + CARD_WIDTH / 2;
  const cy = c.y + CARD_HEIGHT / 2;
  return cx >= r.x && cx <= r.x + r.width && cy >= r.y && cy <= r.y + r.height;
};

export function startLiveFit(draggedIds: string[]) {
  const t = useTable.getState();
  liveIds = new Set(draggedIds);
  motion = null;
  const dragged = draggedIds.map((id) => t.cards[id]).filter(Boolean);
  live = Object.values(t.fences)
    .filter((f) => !f.stacked && f.view === 'custom' && (!f.parentId || groupShown(f, t.fences)))
    .map((f) => {
      const still = cardsInFence(t, f.id).filter((c) => !liveIds.has(c.id));
      const base = fitFence(f, still);
      return { fenceId: f.id, base, still, held: new Set(dragged.filter((c) => centerIn(c, base)).map((c) => c.id)) };
    });
}

/** How fast the dragged cards are moving, in screen px per ms (smoothed). */
function dragSpeed(lead: TableCard | undefined, zoom: number): number {
  if (!lead) return 0;
  const now = performance.now();
  if (!motion) {
    motion = { x: lead.x, y: lead.y, t: now, speed: 0 };
    return 0;
  }
  const dt = Math.max(1, now - motion.t);
  const instant = (Math.hypot(lead.x - motion.x, lead.y - motion.y) * zoom) / dt;
  motion = { x: lead.x, y: lead.y, t: now, speed: motion.speed * 0.6 + instant * 0.4 };
  return motion.speed;
}

export function liveFit() {
  if (!live.length) return;
  const t = useTable.getState();
  const dragged = [...liveIds].map((id) => t.cards[id]).filter(Boolean);
  const fast = dragSpeed(dragged[0], t.camera.zoom) > LET_GO_SPEED;
  const rects: Record<string, Rect> = {};
  for (const entry of live) {
    const fence = t.fences[entry.fenceId];
    if (!fence) continue;
    // In: over the fence's own area, or held (and not flicked away).
    const inside = dragged.filter((c) => centerIn(c, entry.base) || (entry.held.has(c.id) && !fast));
    entry.held = new Set(inside.map((c) => c.id));
    const r = fitFence(fence, [...entry.still, ...inside]);
    if (r.x !== fence.x || r.y !== fence.y || r.width !== fence.width || r.height !== fence.height) rects[entry.fenceId] = r;
  }
  if (Object.keys(rects).length) t.placeCards({}, rects);
}

export function endLiveFit() {
  live = [];
  motion = null;
  liveIds = new Set();
}
