// The .table file: the saved part of the table state as versioned JSON.
// Selection and the active tool are session-only and never saved.
import type { Camera, Fence, TableCard, TableState, Tag } from './types';
import type { Format } from '../rules/formats';

export const TABLE_FILE_VERSION = 1;

export interface TableFile {
  app: 'table';
  version: number;
  deckName: string;
  format: string;
  cards: Record<string, TableCard>;
  fences: Record<string, Fence>;
  tags: Record<string, Tag>;
  camera: Camera;
  /** A copy of the table's custom format, so the file opens on any machine. */
  customFormat?: Format;
}

export type SavedState = Omit<TableFile, 'app' | 'version' | 'customFormat'>;

export function toTableFile(s: TableState, customFormat?: Format): string {
  const file: TableFile = {
    app: 'table',
    version: TABLE_FILE_VERSION,
    deckName: s.deckName,
    format: s.format,
    cards: s.cards,
    fences: s.fences,
    tags: s.tags,
    camera: s.camera,
    ...(customFormat ? { customFormat } : {}),
  };
  return JSON.stringify(file, null, 1);
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Parse and check a .table file. Throws a readable message if it isn't one. */
export function parseTableFile(text: string): { state: SavedState; customFormat?: Format } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('This file is not a .table file (it is not valid JSON).');
  }
  if (!isObject(raw) || raw.app !== 'table') throw new Error('This file is not a .table file.');
  if (typeof raw.version !== 'number' || raw.version > TABLE_FILE_VERSION) {
    throw new Error('This .table file was saved by a newer version of Table.');
  }
  if (!isObject(raw.cards) || !isObject(raw.fences) || !isObject(raw.tags)) throw new Error('This .table file is damaged.');
  for (const card of Object.values(raw.cards)) {
    if (!isObject(card) || !Array.isArray(card.copies) || !card.copies.length || typeof card.x !== 'number') {
      throw new Error('This .table file is damaged (a card is missing its data).');
    }
  }
  const camera = isObject(raw.camera) && typeof raw.camera.zoom === 'number' ? (raw.camera as unknown as Camera) : { x: 0, y: 0, zoom: 1 };
  const customFormat =
    isObject(raw.customFormat) && typeof raw.customFormat.id === 'string' && Array.isArray(raw.customFormat.zones)
      ? (raw.customFormat as unknown as Format)
      : undefined;
  const state: SavedState = {
    deckName: typeof raw.deckName === 'string' ? raw.deckName : 'Untitled deck',
    format: typeof raw.format === 'string' ? raw.format : 'none',
    cards: raw.cards as Record<string, TableCard>,
    fences: raw.fences as Record<string, Fence>,
    tags: raw.tags as Record<string, Tag>,
    camera,
  };
  return { state, customFormat };
}
