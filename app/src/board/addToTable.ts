// Adding and removing cards without dragging (the +/- buttons on panel cards).
// A new card goes into the deck's main zone fence when there is one: on top
// of its other copies as a stepped column, or in the next free slot. With no
// such fence it lands in the middle of the view.
import { useTable } from '../model/store';
import { CARD_HEIGHT, CARD_WIDTH, cardsInFence, fenceOf, mergeCount } from '../model/derived';
import type { Card, Fence, TableCard } from '../model/types';
import { printingOf } from '../model/card';
import { COLUMN_WIDTH, FIRST_CARD, GRID, STEP } from '../fences/layout';
import { settleFences } from '../fences/actions';
import { currentFormat } from '../formats/formatsStore';
import { snapCard } from './snapping';

/** Copies of a card (this printing) on the whole table. */
export function copiesOnTable(cards: Record<string, TableCard>, printing: string): number {
  let n = 0;
  for (const c of Object.values(cards)) if (printingOf(c) === printing) n += mergeCount(c);
  return n;
}

function mainFence(): Fence | undefined {
  const t = useTable.getState();
  const main = currentFormat().zones[0]?.name ?? 'Main';
  return Object.values(t.fences).find((f) => f.section === main && !f.stacked);
}

function boardCenter(): { x: number; y: number } {
  const t = useTable.getState();
  const r = document.getElementById('board')?.getBoundingClientRect();
  const w = r?.width ?? 800;
  const h = r?.height ?? 600;
  return { x: (w / 2 - t.camera.x) / t.camera.zoom, y: (h / 2 - t.camera.y) / t.camera.zoom };
}

/** Where the next copy of this printing should go. */
function spotFor(printing: string): { x: number; y: number } {
  const t = useTable.getState();
  const fence = mainFence();
  const fences = Object.values(t.fences);
  const pool = fence ? cardsInFence(t, fence.id) : Object.values(t.cards).filter((c) => !fenceOf(c, fences));
  // On top of the lowest copy already there.
  const same = pool.filter((c) => printingOf(c) === printing).sort((a, b) => b.y - a.y)[0];
  if (same) return { x: same.x, y: same.y + STEP };
  if (!fence) {
    const c = boardCenter();
    return snapCard({ x: c.x - CARD_WIDTH / 2 + pool.length * GRID, y: c.y - CARD_HEIGHT / 2 + pool.length * GRID });
  }
  // Next free column in the fence.
  const top = fence.y + FIRST_CARD.y;
  const used = new Set(pool.map((c) => Math.round((c.x - fence.x - FIRST_CARD.x) / COLUMN_WIDTH)));
  let col = 0;
  while (used.has(col)) col++;
  return { x: fence.x + FIRST_CARD.x + col * COLUMN_WIDTH, y: top };
}

/** Put copies of these card objects on the table. */
export function addToTable(cards: Card[]) {
  const t = useTable.getState();
  const ids = cards.map((card) => {
    const p = spotFor(printingOf(card));
    return t.addCard(card, p.x, p.y);
  });
  settleFences();
  return ids;
}

/** Take one copy of a card (this printing) off the table: the most recently added. */
export function removeOneFromTable(printing: string) {
  const t = useTable.getState();
  const matches = Object.values(t.cards).filter((c) => printingOf(c) === printing);
  const last = matches[matches.length - 1];
  if (last) t.removeCopy(last.id);
}

/**
 * One more copy of a card on the table: a merged card just holds one more;
 * otherwise the copy goes at the bottom of the card's stepped column.
 */
export function addCopyOf(card: TableCard) {
  const t = useTable.getState();
  if (card.copies.length > 1) return t.addCopy(card.id);
  const cards = Object.values(t.cards);
  const at = (x: number, y: number) => cards.some((c) => Math.abs(c.x - x) < 2 && Math.abs(c.y - y) < 2);
  let y = card.y;
  while (at(card.x, y + STEP)) y += STEP;
  t.addCard({ ...card, copies: [card.copies[0]] }, card.x, y + STEP);
  settleFences();
}
