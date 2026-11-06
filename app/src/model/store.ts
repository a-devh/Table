// The one shared table state. Components read slices with useTable(selector)
// and change state only through the named actions below.
import { create } from 'zustand';
import type { Card, CardData, Fence, FenceLayout, FenceView, Point, Rect, TableCard, TableState, Tool } from './types';
import { CARD_HEIGHT, CARD_WIDTH, cardsInFence } from './derived';
import type { SavedState } from './tableFile';

import { newId } from './ids';
import { cloneCard, swapCard } from './card';
import { FENCE_PAD } from '../fences/layout';

interface Actions {
  /** Put a copy of a card object on the table (the original stays where it was). */
  /** Put a copy of a card object on the table (optionally turned over, for a double-faced card). */
  addCard: (card: Card, x: number, y: number, flipped?: boolean) => string;
  moveCards: (ids: string[], dx: number, dy: number) => void;
  removeCards: (ids: string[]) => void;
  /** Add one more copy (same printing) to a merged card. */
  addCopy: (cardId: string) => void;
  /** Take one copy off a card (a merged stack loses one copy; a single card is removed). */
  removeCopy: (cardId: string) => void;
  /** Draw these cards above all others (the card order is the drawing order, and it's saved). */
  bringToFront: (ids: string[]) => void;
  /** Draw these cards under every other card (in the given order). */
  sendToBack: (ids: string[]) => void;
  select: (ids: string[]) => void;
  createTag: (name: string) => string;
  tagCard: (cardId: string, tagId: string) => void;
  untagCard: (cardId: string, tagId: string) => void;
  /** Merge cards with the same name into one card object holding all their copies (per name). */
  mergeCards: (ids: string[]) => void;
  /** Split a merged card into single cards, stepped down by `step`. */
  splitCard: (cardId: string, step: number) => void;
  /** Change the printing (art) of every copy in a card. */
  /** Trade a card for a new card object of another printing, in the same place (same copies count, tags, position). */
  swapPrinting: (cardId: string, data: CardData) => void;
  /** Turn double-faced cards over (single-faced ones are left alone). */
  flipCards: (ids: string[]) => void;
  /** Draw a fence; with `parentId` it's a group inside that fence. */
  drawFence: (x: number, y: number, width: number, height: number, section: string, name: string, parentId?: string) => string;
  moveFence: (fenceId: string, dx: number, dy: number, cardIds: string[]) => void;
  resizeFence: (fenceId: string, width: number, height: number) => void;
  /** Move and size a fence to this rectangle and make it the fence's frame (its smallest size). */
  setFenceFrame: (fenceId: string, rect: Rect) => void;
  /** Remove a fence. Its cards stay on the table. */
  removeFence: (fenceId: string) => void;
  renameFence: (fenceId: string, name: string) => void;
  /** Switch view. `layout` is the sorted arrangement (ignored for Custom, which restores the saved one). */
  setFenceView: (fenceId: string, view: FenceView, layout: FenceLayout | null) => void;
  /** Move cards to absolute positions (drawn on top, top-to-bottom) and grow (never shrink) fences to the given sizes. */
  placeCards: (positions: Record<string, Point>, fenceRects?: Record<string, Rect>) => void;
  setAnalyticsPinned: (fenceId: string, pinned: boolean) => void;
  stackFence: (fenceId: string) => void;
  unstackFence: (fenceId: string) => void;
  /** Replace the whole table (New or Open). */
  loadTable: (saved: SavedState | null) => void;
  renameDeck: (name: string) => void;
  setFormat: (format: string) => void;
  setTool: (tool: Tool) => void;
  panBy: (dx: number, dy: number) => void;
  zoomAt: (factor: number, screenX: number, screenY: number) => void;
  resetZoom: () => void;
}

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 3;

function positionsOf(cards: TableCard[], relativeTo: Point = { x: 0, y: 0 }): Record<string, Point> {
  return Object.fromEntries(cards.map((c) => [c.id, { x: c.x - relativeTo.x, y: c.y - relativeTo.y }]));
}

function withPositions(cards: Record<string, TableCard>, positions: Record<string, Point>) {
  const next = { ...cards };
  for (const [id, p] of Object.entries(positions)) if (next[id]) next[id] = { ...next[id], x: p.x, y: p.y };
  return next;
}

/**
 * Move cards into a layout and draw them on top, top-to-bottom, so in a
 * stepped column each card covers the one above it (the card order is the
 * drawing order).
 */
function laidOut(cards: Record<string, TableCard>, positions: Record<string, Point>) {
  const moved = withPositions(cards, positions);
  const ids = Object.keys(positions).filter((id) => moved[id]);
  if (!ids.length) return moved;
  ids.sort((a, b) => moved[a].y - moved[b].y || moved[a].x - moved[b].x);
  const placed = new Set(ids);
  const next: Record<string, TableCard> = {};
  for (const [id, c] of Object.entries(moved)) if (!placed.has(id)) next[id] = c;
  for (const id of ids) next[id] = moved[id];
  return next;
}

export const initialState: TableState = {
  deckName: 'Untitled deck',
  format: 'none',
  cards: {},
  fences: {},
  tags: {},
  camera: { x: 0, y: 0, zoom: 1 },
  selection: [],
  activeTool: 'hand',
};

export const useTable = create<TableState & Actions>()((set) => ({
  ...initialState,

  addCard: (card, x, y, flipped) => {
    const placed: TableCard = { ...cloneCard(card), x, y, rotation: 0, ...(flipped && card.copies[0].data.back ? { flipped: true } : {}) };
    set((s) => ({ cards: { ...s.cards, [placed.id]: placed } }));
    return placed.id;
  },

  moveCards: (ids, dx, dy) =>
    set((s) => {
      const cards = { ...s.cards };
      for (const id of ids) if (cards[id]) cards[id] = { ...cards[id], x: cards[id].x + dx, y: cards[id].y + dy };
      return { cards };
    }),

  removeCards: (ids) =>
    set((s) => {
      const cards = { ...s.cards };
      for (const id of ids) delete cards[id];
      return { cards, selection: s.selection.filter((id) => !ids.includes(id)) };
    }),

  addCopy: (cardId) =>
    set((s) => {
      const card = s.cards[cardId];
      if (!card) return {};
      return { cards: { ...s.cards, [cardId]: { ...card, copies: [...card.copies, { copyId: newId('copy'), data: card.copies[0].data }] } } };
    }),

  removeCopy: (cardId) =>
    set((s) => {
      const card = s.cards[cardId];
      if (!card) return {};
      const cards = { ...s.cards };
      if (card.copies.length > 1) cards[cardId] = { ...card, copies: card.copies.slice(0, -1) };
      else delete cards[cardId];
      return { cards, selection: cards[cardId] ? s.selection : s.selection.filter((id) => id !== cardId) };
    }),

  bringToFront: (ids) =>
    set((s) => {
      const front = new Set(ids);
      const cards: Record<string, TableCard> = {};
      for (const [id, c] of Object.entries(s.cards)) if (!front.has(id)) cards[id] = c;
      for (const id of ids) if (s.cards[id]) cards[id] = s.cards[id];
      return { cards };
    }),

  sendToBack: (ids) =>
    set((s) => {
      const back = new Set(ids);
      const cards: Record<string, TableCard> = {};
      for (const id of ids) if (s.cards[id]) cards[id] = s.cards[id];
      for (const [id, c] of Object.entries(s.cards)) if (!back.has(id)) cards[id] = c;
      return { cards };
    }),

  select: (ids) => set({ selection: ids }),

  createTag: (name) => {
    const id = newId('tag');
    set((s) => ({ tags: { ...s.tags, [id]: { id, name } } }));
    return id;
  },

  tagCard: (cardId, tagId) =>
    set((s) => {
      const card = s.cards[cardId];
      if (!card || card.tagIds.includes(tagId)) return {};
      return { cards: { ...s.cards, [cardId]: { ...card, tagIds: [...card.tagIds, tagId] } } };
    }),

  untagCard: (cardId, tagId) =>
    set((s) => {
      const card = s.cards[cardId];
      if (!card || !card.tagIds.includes(tagId)) return {};
      return { cards: { ...s.cards, [cardId]: { ...card, tagIds: card.tagIds.filter((t) => t !== tagId) } } };
    }),

  mergeCards: (ids) =>
    set((s) => {
      const byPrinting = new Map<string, TableCard[]>();
      for (const id of ids) {
        const c = s.cards[id];
        if (!c) continue;
        // Only the same printing merges.
        const printing = c.copies[0].data.scryfallId;
        byPrinting.set(printing, [...(byPrinting.get(printing) ?? []), c]);
      }
      const cards = { ...s.cards };
      const removed = new Set<string>();
      for (const group of byPrinting.values()) {
        if (group.length < 2) continue;
        // The topmost card stays where it is and takes the others' copies and tags.
        group.sort((a, b) => a.y - b.y || a.x - b.x);
        const [keep, ...rest] = group;
        cards[keep.id] = {
          ...keep,
          copies: group.flatMap((c) => c.copies),
          tagIds: [...new Set(group.flatMap((c) => c.tagIds))],
        };
        for (const c of rest) {
          delete cards[c.id];
          removed.add(c.id);
        }
      }
      return { cards, selection: s.selection.filter((id) => !removed.has(id)) };
    }),

  splitCard: (cardId, step) =>
    set((s) => {
      const card = s.cards[cardId];
      if (!card || card.copies.length < 2) return {};
      const cards = { ...s.cards };
      const ids: string[] = [];
      card.copies.forEach((copy, i) => {
        const id = i === 0 ? card.id : newId('card');
        cards[id] = { ...card, id, copies: [copy], y: card.y + i * step };
        ids.push(id);
      });
      return { cards, selection: ids };
    }),

  swapPrinting: (cardId, data) =>
    set((s) => {
      const old = s.cards[cardId];
      if (!old) return {};
      const swapped: TableCard = { ...old, ...swapCard(old, data) };
      // Keep the drawing order: the new card takes the old one's slot.
      const cards: Record<string, TableCard> = {};
      for (const [id, c] of Object.entries(s.cards)) cards[id === cardId ? swapped.id : id] = id === cardId ? swapped : c;
      const fences = { ...s.fences };
      for (const [fid, f] of Object.entries(fences)) {
        if (!f.customLayout[cardId]) continue;
        const { [cardId]: spot, ...rest } = f.customLayout;
        fences[fid] = { ...f, customLayout: { ...rest, [swapped.id]: spot } };
      }
      const selection = s.selection.map((id) => (id === cardId ? swapped.id : id));
      return { cards, fences, selection };
    }),

  flipCards: (ids) =>
    set((s) => {
      const cards = { ...s.cards };
      let changed = false;
      for (const id of ids) {
        const c = cards[id];
        if (!c?.copies[0].data.back) continue;
        cards[id] = { ...c, flipped: !c.flipped };
        changed = true;
      }
      return changed ? { cards } : {};
    }),

  drawFence: (x, y, width, height, section, name, parentId) => {
    const id = newId('fence');
    const fence: Fence = {
      id, name, section, x, y, width, height, frame: { x, y, width, height }, ...(parentId ? { parentId } : {}),
      stacked: false, view: 'custom', analyticsPinned: false, customLayout: {},
    };
    set((s) => ({ fences: { ...s.fences, [id]: fence } }));
    return id;
  },

  moveFence: (fenceId, dx, dy, cardIds) =>
    set((s) => {
      const f = s.fences[fenceId];
      if (!f) return {};
      const cards = { ...s.cards };
      for (const id of cardIds) if (cards[id]) cards[id] = { ...cards[id], x: cards[id].x + dx, y: cards[id].y + dy };
      // The fence's groups move with it.
      const fences = { ...s.fences };
      for (const g of Object.values(s.fences)) {
        if (g.id !== fenceId && g.parentId !== fenceId) continue;
        const frame = g.frame && { ...g.frame, x: g.frame.x + dx, y: g.frame.y + dy };
        fences[g.id] = { ...g, x: g.x + dx, y: g.y + dy, frame };
      }
      return { fences, cards };
    }),



  renameFence: (fenceId, name) =>
    set((s) => (s.fences[fenceId] ? { fences: { ...s.fences, [fenceId]: { ...s.fences[fenceId], name } } } : {})),

  removeFence: (fenceId) =>
    set((s) => {
      const fences = { ...s.fences };
      delete fences[fenceId];
      // Its groups go too (their cards stay).
      for (const g of Object.values(s.fences)) if (g.parentId === fenceId) delete fences[g.id];
      return { fences };
    }),

  setFenceFrame: (fenceId, rect) =>
    set((s) => {
      const f = s.fences[fenceId];
      return f ? { fences: { ...s.fences, [fenceId]: { ...f, ...rect, frame: { ...rect } } } } : {};
    }),

  resizeFence: (fenceId, width, height) =>
    set((s) => {
      const f = s.fences[fenceId];
      // Resizing sets the frame the fence fits around its cards from.
      return f ? { fences: { ...s.fences, [fenceId]: { ...f, width, height, frame: { x: f.x, y: f.y, width, height } } } } : {};
    }),

  setFenceView: (fenceId, view, layout) =>
    set((s) => {
      const f = s.fences[fenceId];
      // Picking a sorted view again sorts the cards back (after hand edits); Custom again does nothing.
      if (!f || f.stacked || (f.view === view && view === 'custom')) return {};
      const members = cardsInFence(s, fenceId);
      // Leaving Custom saves the user's arrangement; returning restores it.
      const customLayout = f.view === 'custom' ? positionsOf(members) : f.customLayout;
      let target: Record<string, Point> = {};
      let width = f.width;
      let height = f.height;
      if (view === 'custom') {
        // Cards added since keep their spot.
        for (const c of members) if (customLayout[c.id]) target[c.id] = customLayout[c.id];
      } else if (layout) {
        target = layout.positions;
        width = Math.max(width, layout.width);
        height = Math.max(height, layout.height);
      }
      return {
        // A sorted view lays out stepped columns; Custom keeps the user's drawing order.
        cards: view === 'custom' ? withPositions(s.cards, target) : laidOut(s.cards, target),
        fences: { ...s.fences, [fenceId]: { ...f, view, customLayout, width, height } },
      };
    }),

  placeCards: (positions, fenceRects = {}) =>
    set((s) => {
      const fences = { ...s.fences };
      for (const [id, r] of Object.entries(fenceRects)) {
        const f = fences[id];
        if (f && (r.x !== f.x || r.y !== f.y || r.width !== f.width || r.height !== f.height)) fences[id] = { ...f, ...r };
      }
      return { cards: laidOut(s.cards, positions), fences };
    }),

  setAnalyticsPinned: (fenceId, analyticsPinned) =>
    set((s) => (s.fences[fenceId] ? { fences: { ...s.fences, [fenceId]: { ...s.fences[fenceId], analyticsPinned } } } : {})),

  stackFence: (fenceId) =>
    set((s) => {
      const f = s.fences[fenceId];
      if (!f || f.stacked) return {};
      const members = cardsInFence(s, fenceId);
      // A face-down pile: exactly one card inside the fence's one-cell padding, and the fence shrinks to fit it.
      const target: Record<string, Point> = {};
      for (const c of members) target[c.id] = { x: f.x + FENCE_PAD, y: f.y + FENCE_PAD };
      return {
        cards: withPositions(s.cards, target),
        fences: {
          ...s.fences,
          [fenceId]: {
            ...f,
            stacked: true,
            unstacked: { width: f.width, height: f.height, positions: positionsOf(members, f) },
            width: CARD_WIDTH + FENCE_PAD * 2,
            height: CARD_HEIGHT + FENCE_PAD * 2,
          },
        },
      };
    }),

  unstackFence: (fenceId) =>
    set((s) => {
      const f = s.fences[fenceId];
      if (!f || !f.stacked) return {};
      const saved = f.unstacked;
      // Saved positions are relative to the fence, so a moved pile unstacks where it now is.
      const target: Record<string, Point> = {};
      if (saved) {
        for (const c of cardsInFence(s, fenceId)) {
          const p = saved.positions[c.id];
          if (p) target[c.id] = { x: f.x + p.x, y: f.y + p.y };
        }
      }
      return {
        cards: withPositions(s.cards, target),
        fences: {
          ...s.fences,
          [fenceId]: { ...f, stacked: false, unstacked: undefined, width: saved?.width ?? f.width, height: saved?.height ?? f.height },
        },
      };
    }),

  loadTable: (saved) =>
    set((s) => ({ ...initialState, ...(saved ?? {}), activeTool: s.activeTool, selection: [] })),

  renameDeck: (deckName) => set({ deckName }),
  setFormat: (format) => set({ format }),
  setTool: (activeTool) => set({ activeTool }),

  panBy: (dx, dy) => set((s) => ({ camera: { ...s.camera, x: s.camera.x + dx, y: s.camera.y + dy } })),

  zoomAt: (factor, screenX, screenY) =>
    set((s) => {
      const { x, y, zoom } = s.camera;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
      // Keep the point under the cursor fixed while zooming.
      const worldX = (screenX - x) / zoom;
      const worldY = (screenY - y) / zoom;
      return { camera: { zoom: next, x: screenX - worldX * next, y: screenY - worldY * next } };
    }),

  resetZoom: () => set((s) => ({ camera: { ...s.camera, zoom: 1 } })),
}));
