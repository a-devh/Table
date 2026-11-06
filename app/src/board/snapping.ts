// Where dragged cards land when let go.
// - Stack magnetism: drop a card over another card and it stacks onto it, in
//   whichever direction's spot is nearest: down showing just the name, down
//   showing half the card, sideways, or diagonally. Several dragged cards
//   carry on in the same direction. Stacking wins over the grid.
// - Grid snap: otherwise the dragged cards move together so the card under
//   the pointer has its top-left corner on the nearest dot. Off in Settings,
//   or hold Alt while dragging.
// The same answer drives the landing preview while dragging.
// Fences snap too: drawing, moving and resizing put their edges on the grid.
import { create } from 'zustand';
import { useTable } from '../model/store';
import type { Point, TableCard } from '../model/types';
import { GRID, STEP } from '../fences/layout';
import { CARD_HEIGHT, CARD_WIDTH } from '../model/derived';
import { useSettings } from '../settings/settingsStore';

/** The ways a card can stack onto another: offset of its top-left from the other card's. */
export const STACK_DIRECTIONS: Record<string, Point> = {
  /** Down, covering all but the name strip. */
  name: { x: 0, y: STEP },
  /** Down, covering the bottom half. */
  half: { x: 0, y: Math.round(CARD_HEIGHT / 2 / GRID) * GRID },
  /** Sideways, showing the card's left strip. */
  side: { x: GRID * 2, y: 0 },
  /** Diagonally down and right. */
  diagonal: { x: GRID * 2, y: GRID * 2 },
};

/**
 * A dropped card stacks onto a card when its top-left lands in this zone
 * around that card's top-left: anywhere over the card, give or take a dot.
 */
const STACK_ZONE = { left: -GRID, right: CARD_WIDTH * 0.75, top: -GRID, bottom: CARD_HEIGHT * 0.75 };

/** The snap step at this zoom: the dot spacing, doubled while dots would be closer than 14px on screen. */
export function gridStep(zoom = useTable.getState().camera.zoom): number {
  let step = GRID;
  while (step * zoom < 14) step *= 2;
  return step;
}

const snapping = (noGrid: boolean) => !noGrid && useSettings.getState().gridSnap;

export interface Landing {
  kind: 'grid' | 'stack';
  positions: Record<string, Point>;
}

export function landingFor(ids: string[], leadId: string | undefined, noGrid = false): Landing | null {
  const { cards } = useTable.getState();
  const dragged = ids.map((id) => cards[id]).filter(Boolean) as TableCard[];
  if (!dragged.length) return null;
  const lead = (leadId && cards[leadId]) || dragged[dragged.length - 1];
  const moving = new Set(ids);
  const others = Object.values(cards).filter((c) => !moving.has(c.id));

  // Stack: the nearest free spot (in any direction) of a card the dragged card is over.
  const taken = (x: number, y: number) => others.some((c) => Math.abs(c.x - x) < 2 && Math.abs(c.y - y) < 2);
  let best: { spot: Point; step: Point } | null = null;
  let bestDist = Infinity;
  for (const c of others) {
    const rx = lead.x - c.x;
    const ry = lead.y - c.y;
    if (rx < STACK_ZONE.left || rx > STACK_ZONE.right || ry < STACK_ZONE.top || ry > STACK_ZONE.bottom) continue;
    for (const step of Object.values(STACK_DIRECTIONS)) {
      const spot = { x: c.x + step.x, y: c.y + step.y };
      if (taken(spot.x, spot.y)) continue;
      const d = Math.hypot(lead.x - spot.x, lead.y - spot.y);
      if (d < bestDist) {
        bestDist = d;
        best = { spot, step };
      }
    }
  }
  if (best) {
    const { spot, step } = best;
    const ordered = [...dragged].sort((a, b) => a.y - b.y || a.x - b.x);
    const positions: Record<string, Point> = {};
    ordered.forEach((c, i) => (positions[c.id] = { x: spot.x + i * step.x, y: spot.y + i * step.y }));
    return { kind: 'stack', positions };
  }

  if (!snapping(noGrid)) return null;
  const to = snapCard(lead);
  const dx = to.x - lead.x;
  const dy = to.y - lead.y;
  const positions: Record<string, Point> = {};
  for (const c of dragged) positions[c.id] = { x: c.x + dx, y: c.y + dy };
  return { kind: 'grid', positions };
}

/** Round a table coordinate to the nearest dot, unless snapping is off (Settings) or Alt is held. */
export function snapToGrid(v: number, noGrid = false): number {
  if (!snapping(noGrid)) return v;
  const step = gridStep();
  return Math.round(v / step) * step;
}

/** Where a card's top-left corner goes: the nearest dot. */
export function snapCard(p: Point, noGrid = false): Point {
  return { x: snapToGrid(p.x, noGrid), y: snapToGrid(p.y, noGrid) };
}

/** Move the cards to where they land and put them on top of everything else. */
export function land(ids: string[], leadId: string | undefined, noGrid = false) {
  const landing = landingFor(ids, leadId, noGrid);
  const t = useTable.getState();
  // placeCards draws them on top in top-to-bottom order, so a stack stays in order.
  if (landing) t.placeCards(landing.positions);
  else t.bringToFront([...ids].sort((a, b) => (t.cards[a]?.y ?? 0) - (t.cards[b]?.y ?? 0)));
  // Put down on its own (touching no other card): it goes back to the table's own level, under any pile.
  const after = useTable.getState();
  const moved = new Set(ids);
  const placed = Object.keys(after.cards).filter((id) => moved.has(id));
  const others = Object.values(after.cards).filter((c) => !moved.has(c.id));
  const touches = placed.some((id) => {
    const c = after.cards[id];
    return others.some((o) => Math.abs(o.x - c.x) < CARD_WIDTH && Math.abs(o.y - c.y) < CARD_HEIGHT);
  });
  if (!touches && placed.length) after.sendToBack(placed);
  useLandingPreview.getState().set(null);
}

/** The landing preview the board draws while cards are dragged. */
export const useLandingPreview = create<{ landing: Landing | null; set: (landing: Landing | null) => void }>()((set) => ({
  landing: null,
  set: (landing) => set({ landing }),
}));
