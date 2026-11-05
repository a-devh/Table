// Pure fence-view rules: which group a card goes in and where it sits.
// No state or UI here, so the rules are easy to read and test.
import { CARD_HEIGHT, CARD_WIDTH, GRID_CELL, mergeCount } from '../model/derived';
import { TYPE_ORDER, primaryType } from '../rules/cardTypes';
import { xCount } from '../rules/analytics';
import type { Fence, FenceLayout, FenceView, Point, Rect, TableCard, Tag } from '../model/types';

/** Table grid spacing: the distance between the dots. Everything snaps to dots only. */
export const GRID = GRID_CELL;
/** Round up to whole grid steps, so edges stay on the dots. */
const upToGrid = (v: number) => Math.ceil(v / GRID) * GRID;
/**
 * A card's top-left corner snaps to a dot, and a card is a whole number of grid
 * steps (5 x 7). Laid out, each card gets a cell one step wider and taller
 * (6 x 8 = 336 x 448), so there is a one-step gap between cards.
 */
export const CELL_WIDTH = upToGrid(CARD_WIDTH + GRID / 2);
export const CELL_HEIGHT = upToGrid(CARD_HEIGHT + GRID / 2);
/** Room at the top of a sorted fence for the group labels. */
export const GROUP_LABEL_SPACE = GRID;
/** Sorted fences put one column of cells per group. */
export const COLUMN_WIDTH = CELL_WIDTH;
/** Where a sorted fence's first card goes, relative to the fence (the padding; group labels sit in the top padding). */
export const FIRST_CARD = { x: GRID, y: GROUP_LABEL_SPACE };
/** Padding between a fence's edges and its cards: the same on every side. */
export const FENCE_PAD = GRID;
/** How much of each card shows in a stepped column. */
export const STEP = GRID; // one grid step, so every card in a stack starts on a dot

const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G', 'Multicolor', 'Colorless'];

export interface Group {
  label: string;
  cards: TableCard[];
  count: number;
}

function groupKey(card: TableCard, view: FenceView, tags: Record<string, Tag>): string {
  const d = card.copies[0].data;
  switch (view) {
    case 'cmc': {
      // Every mana value gets its own column; X spells get X / XX / XXX.
      if (/\bLand\b/.test(d.typeLine)) return 'Land';
      const x = xCount(d.manaCost);
      return x ? 'X'.repeat(Math.min(3, x)) : String(Math.floor(d.cmc));
    }
    case 'type':
      return primaryType(d.typeLine);
    case 'color':
      if (d.colors.length > 1) return 'Multicolor';
      return d.colors[0] ?? 'Colorless';
    case 'rarity':
      return RARITY_LABEL[d.rarity ?? ''] ?? 'Special';
    case 'set':
      return d.set.toUpperCase();
    case 'tags':
      // A card with several tags goes under its first one.
      return tags[card.tagIds[0]]?.name ?? 'Untagged';
    default:
      return '';
  }
}

const RARITY_LABEL: Record<string, string> = { mythic: 'Mythic', rare: 'Rare', uncommon: 'Uncommon', common: 'Common' };

function keyOrder(view: FenceView, tags: Record<string, Tag>, present: string[]): string[] {
  switch (view) {
    case 'cmc': {
      const values = present.filter((k) => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
      return [...values, 'X', 'XX', 'XXX', 'Land'];
    }
    case 'rarity':
      return ['Mythic', 'Rare', 'Uncommon', 'Common', 'Special'];
    case 'set':
      return [...present].sort();
    case 'type':
      return [...TYPE_ORDER, 'Other'];
    case 'color':
      return COLOR_ORDER;
    case 'tags':
      return ['Untagged', ...Object.values(tags).map((t) => t.name)];
    default:
      return [];
  }
}

/** Cards split into the view's groups, in display order. Empty groups are left out. */
export function groupCards(cards: TableCard[], view: FenceView, tags: Record<string, Tag>): Group[] {
  const byKey = new Map<string, TableCard[]>();
  for (const c of cards) {
    const k = groupKey(c, view, tags);
    byKey.set(k, [...(byKey.get(k) ?? []), c]);
  }
  return keyOrder(view, tags, [...byKey.keys()])
    .filter((k) => byKey.has(k))
    .map((label) => {
      const list = byKey.get(label)!.sort((a, b) => {
        const da = a.copies[0].data;
        const db = b.copies[0].data;
        return da.cmc - db.cmc || da.name.localeCompare(db.name);
      });
      return { label, cards: list, count: list.reduce((n, c) => n + mergeCount(c), 0) };
    });
}

/** One stepped column per group, left to right, inside the fence. */
export function layoutFence(fence: Fence, cards: TableCard[], tags: Record<string, Tag>): FenceLayout {
  const groups = groupCards(cards, fence.view, tags);
  const positions: Record<string, Point> = {};
  let tallest = 0;
  groups.forEach((g, col) => {
    g.cards.forEach((c, row) => {
      positions[c.id] = {
        x: fence.x + FIRST_CARD.x + col * COLUMN_WIDTH,
        y: fence.y + FIRST_CARD.y + row * STEP,
      };
    });
    tallest = Math.max(tallest, CARD_HEIGHT + (g.cards.length - 1) * STEP);
  });
  return {
    positions,
    // Columns are a gap apart; the last one gets the padding instead.
    width: FIRST_CARD.x + Math.max(1, groups.length) * COLUMN_WIDTH - (COLUMN_WIDTH - CARD_WIDTH) + FENCE_PAD,
    height: FIRST_CARD.y + tallest + FENCE_PAD,
  };
}

/** The rectangle the user drew or last resized the fence to (older files: its current one). */
export const frameOf = (f: Fence): Rect => f.frame ?? { x: f.x, y: f.y, width: f.width, height: f.height };

const downToGrid = (v: number) => Math.floor(v / GRID) * GRID;

/**
 * Where a fence sits: its frame, grown on any side so every card keeps one
 * cell of padding from the edge. Run again after cards move, the fence grows
 * toward cards near an edge and shrinks back (never below the frame) when they
 * move away. `content` adds areas it must hold too: a sorted view's laid-out
 * area, or its groups (each with the padding around it).
 */
export function fitFence(fence: Fence, cards: TableCard[], content: Rect[] = []): Rect {
  const frame = frameOf(fence);
  let left = frame.x;
  let top = frame.y;
  let right = frame.x + frame.width;
  let bottom = frame.y + frame.height;
  const include = (x0: number, y0: number, x1: number, y1: number) => {
    left = Math.min(left, x0);
    top = Math.min(top, y0);
    right = Math.max(right, x1);
    bottom = Math.max(bottom, y1);
  };
  for (const c of cards) {
    // Edges stay on the dots even when a card was placed freely (Alt).
    include(downToGrid(c.x - FENCE_PAD), downToGrid(c.y - FENCE_PAD), upToGrid(c.x + CARD_WIDTH + FENCE_PAD), upToGrid(c.y + CARD_HEIGHT + FENCE_PAD));
  }
  for (const r of content) include(r.x, r.y, r.x + r.width, r.y + r.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}
