// Values computed from table state. Never stored, so they can't go stale.
import type { Fence, TableCard, TableState } from './types';

/**
 * The table's grid step (the dot spacing). A card is exactly 5 x 7 grid cells,
 * the closest whole-cell match to a real card's 63 x 88 mm, so card edges sit
 * on the dots.
 */
export const GRID_CELL = 56;
export const CARD_CELLS = { x: 5, y: 7 };
export const CARD_WIDTH = CARD_CELLS.x * GRID_CELL; // 280
export const CARD_HEIGHT = CARD_CELLS.y * GRID_CELL; // 392
/** Table cards are drawn about this many times larger than the 96x134 base layout. */
export const CARD_SCALE = CARD_WIDTH / 96;
/** Corner radius of a card on the table. */
export const CARD_RADIUS = 5 * CARD_SCALE;

export function isMerged(card: TableCard): boolean {
  return card.copies.length > 1;
}

export function mergeCount(card: TableCard): number {
  return card.copies.length;
}

const centerIn = (card: TableCard, f: Fence) => {
  const cx = card.x + CARD_WIDTH / 2;
  const cy = card.y + CARD_HEIGHT / 2;
  return cx >= f.x && cx <= f.x + f.width && cy >= f.y && cy <= f.y + f.height;
};

/** A group shows (and holds cards) only while its fence is open in the Custom view. */
export function groupShown(group: Fence, fences: Record<string, Fence>): boolean {
  const parent = group.parentId ? fences[group.parentId] : undefined;
  return !!parent && parent.view === 'custom' && !parent.stacked;
}

/** The fence (deck section) a card belongs to, decided by the card's center point. Groups count as their fence. */
export function fenceOf(card: TableCard, fences: Fence[]): Fence | undefined {
  // Topmost (last drawn) fence wins if fences overlap.
  for (let i = fences.length - 1; i >= 0; i--) {
    const f = fences[i];
    if (!f.parentId && centerIn(card, f)) return f;
  }
  return undefined;
}

/** The group inside the card's fence that holds it, if any. */
export function groupOf(card: TableCard, fences: Fence[]): Fence | undefined {
  const top = fenceOf(card, fences);
  if (!top || top.view !== 'custom' || top.stacked) return undefined;
  for (let i = fences.length - 1; i >= 0; i--) {
    const f = fences[i];
    if (f.parentId === top.id && centerIn(card, f)) return f;
  }
  return undefined;
}

/** Cards in a fence (including its groups), or in one group. */
export function cardsInFence(state: TableState, fenceId: string): TableCard[] {
  const fences = Object.values(state.fences);
  const fence = state.fences[fenceId];
  if (fence?.parentId) return Object.values(state.cards).filter((c) => groupOf(c, fences)?.id === fenceId);
  return Object.values(state.cards).filter((c) => fenceOf(c, fences)?.id === fenceId);
}

/** Number of cards on the table carrying each tag. */
export function tagCounts(state: TableState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of Object.keys(state.tags)) counts[id] = 0;
  for (const card of Object.values(state.cards)) {
    for (const tagId of card.tagIds) counts[tagId] = (counts[tagId] ?? 0) + mergeCount(card);
  }
  return counts;
}

/** The topmost card under a table point, if any. */
export function cardAt(state: TableState, x: number, y: number): TableCard | undefined {
  const cards = Object.values(state.cards);
  for (let i = cards.length - 1; i >= 0; i--) {
    const c = cards[i];
    if (x >= c.x && x <= c.x + CARD_WIDTH && y >= c.y && y <= c.y + CARD_HEIGHT) return c;
  }
  return undefined;
}
