// Shared data types. No UI code lives here.

/** The subset of Scryfall card data the app keeps with each card. */
export interface CardData {
  scryfallId: string;
  oracleId: string;
  name: string;
  manaCost: string;
  cmc: number;
  typeLine: string;
  colors: string[];
  colorIdentity: string[];
  set: string;
  collectorNumber: string;
  imageKey: string;
  legalities: Record<string, string>;
  /** Scryfall's daily prices for this printing (missing when nobody sells it). */
  prices: { usd?: string; usdFoil?: string; eur?: string; tix?: string };
  /** Colors of mana the card can produce (W/U/B/R/G/C). Missing on older saves. */
  producedMana?: string[];
  /** common / uncommon / rare / mythic (or special, bonus). Missing on older saves. */
  rarity?: string;
}

/** One physical copy: a specific printing of a card. */
export interface CardCopy {
  copyId: string;
  data: CardData;
}

/**
 * A card object. It is the same object wherever it lives: Search, Favorites,
 * Collection or the table. Where it is only changes what you can do with it
 * (a card in Search can't be moved around, for example). A merged card holds
 * several copies of the same card name.
 */
export interface Card {
  id: string;
  copies: CardCopy[];
  tagIds: string[];
}

/** A card on the table: the card object plus where it sits. */
export interface TableCard extends Card {
  x: number;
  y: number;
  rotation: number;
}

export type FenceView = 'custom' | 'cmc' | 'type' | 'color' | 'rarity' | 'set' | 'tags';

export interface Fence {
  id: string;
  name: string;
  section: string;
  x: number;
  y: number;
  width: number;
  height: number;
  stacked: boolean;
  view: FenceView;
  analyticsPinned: boolean;
  /** Card positions saved when leaving the Custom view, restored on return. */
  customLayout: Record<string, Point>;
  /**
   * The rectangle the user drew or resized the fence to. The fence never gets
   * smaller than this; it grows past it to keep a one-cell padding around its
   * cards, and shrinks back as cards move away. Older files don't have it.
   */
  frame?: Rect;
  /**
   * Set on a group: a fence drawn inside another fence (e.g. "Combo pieces" in
   * Main). Groups belong to their fence's section, show only while that fence
   * is open in the Custom view, and move with it.
   */
  parentId?: string;
  /** Size and card positions (relative to the fence) before stacking, so Unstack can put them back. */
  unstacked?: { width: number; height: number; positions: Record<string, Point> };
}

export interface Point {
  x: number;
  y: number;
}

/** Card positions and fence size produced by a fence view. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FenceLayout {
  positions: Record<string, Point>;
  width: number;
  height: number;
}

export interface Tag {
  id: string;
  name: string;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export type Tool = 'hand' | 'pencil';

/** Everything a .table file stores, plus session-only fields. */
export interface TableState {
  deckName: string;
  format: string;
  cards: Record<string, TableCard>;
  fences: Record<string, Fence>;
  tags: Record<string, Tag>;
  camera: Camera;
  // Session only, not saved:
  selection: string[];
  activeTool: Tool;
}
