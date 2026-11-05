// Ctrl+C / Ctrl+X / Ctrl+V for cards on the table.
// Copy keeps the selected card objects (printings, tags, layout) in the app;
// paste puts copies under the pointer (or the middle of the view), on the
// grid, and selects them. Copy also puts a plain card list ("1 Swamp") on the
// system clipboard so it can be pasted into other apps.
import { useEffect } from 'react';
import { useTable } from '../model/store';
import type { Card, Point } from '../model/types';
import { mergeCount } from '../model/derived';
import { nameOf } from '../model/card';
import { settleFences } from '../fences/actions';
import { snapCard } from './snapping';
import { GRID } from '../fences/layout';
import { useCardMenu } from './cardMenuStore';

/** Copied cards with their offsets from the group's top-left corner. */
let copied: { card: Card; offset: Point }[] = [];
let pasteCount = 0;
/** Last pointer position over the table, in screen pixels relative to the board. */
let pointer: Point | null = null;

function copySelection(): boolean {
  const t = useTable.getState();
  const cards = t.selection.map((id) => t.cards[id]).filter(Boolean);
  if (!cards.length) return false;
  // Keep the drawing order so stacks paste the right way up.
  const order = Object.keys(t.cards);
  cards.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const left = Math.min(...cards.map((c) => c.x));
  const top = Math.min(...cards.map((c) => c.y));
  copied = cards.map((c) => ({ card: { id: c.id, copies: c.copies, tagIds: c.tagIds }, offset: { x: c.x - left, y: c.y - top } }));
  pasteCount = 0;
  const counts = new Map<string, number>();
  for (const c of cards) counts.set(nameOf(c), (counts.get(nameOf(c)) ?? 0) + mergeCount(c));
  const text = [...counts].map(([name, n]) => `${n} ${name}`).join('\n');
  navigator.clipboard?.writeText(text).catch(() => {});
  return true;
}

function paste() {
  if (!copied.length) return;
  const t = useTable.getState();
  const board = document.getElementById('board')?.getBoundingClientRect();
  const screen = pointer ?? { x: (board?.width ?? 800) / 2, y: (board?.height ?? 600) / 2 };
  const { x: camX, y: camY, zoom } = t.camera;
  // Pasting again without moving the pointer steps each paste down-right, so copies don't hide each other.
  const shift = pasteCount++ * GRID;
  const { x, y } = snapCard({ x: (screen.x - camX) / zoom + shift, y: (screen.y - camY) / zoom + shift });
  const ids = copied.map(({ card, offset }) => t.addCard(card, x + offset.x, y + offset.y));
  t.select(ids);
  settleFences();
}

/** Keyboard shortcuts for copy, cut and paste (ignored while typing). */
export function useClipboardKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
      const key = e.key.toLowerCase();
      if (key === 'c') {
        if (copySelection()) e.preventDefault();
      } else if (key === 'x') {
        if (!copySelection()) return;
        e.preventDefault();
        const t = useTable.getState();
        t.removeCards(t.selection);
        useCardMenu.getState().close();
      } else if (key === 'v') {
        if (!copied.length) return;
        e.preventDefault();
        paste();
      }
    };
    const onMove = (e: PointerEvent) => {
      const r = document.getElementById('board')?.getBoundingClientRect();
      if (!r) return;
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (inside) {
        const next = { x: e.clientX - r.left, y: e.clientY - r.top };
        if (!pointer || Math.hypot(next.x - pointer.x, next.y - pointer.y) > 4) pasteCount = 0;
        pointer = next;
      } else pointer = null;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);
}
