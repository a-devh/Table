// Talks to Scryfall. Inside the desktop app this goes through the Rust backend
// (which handles headers and rate limiting); in a plain browser (`npm run dev`)
// it calls the API directly so the UI can be worked on without Rust.
import { invoke, isTauri } from '@tauri-apps/api/core';
import type { CardData } from '../model/types';

export type Show = 'prints' | 'cards' | 'art';
/**
 * Scryfall sort orders, plus 'type' and 'identity' (color identity, W U B R G),
 * which Scryfall can't sort by: those results come by name and the app orders
 * the loaded ones.
 * 'released' is only used by the art picker (newest printings first).
 * 'edhrec' is EDHREC popularity (ascending = most played first).
 */
export type SortKey = 'name' | 'cmc' | 'color' | 'rarity' | 'type' | 'identity' | 'usd' | 'edhrec' | 'released';
/**
 * How several picked colors combine: any of them, all of them (maybe more),
 * exactly them, or within them: a color identity inside the picked colors
 * (fits a commander), without colorless cards unless C is picked.
 */
export type ColorMode = 'any' | 'all' | 'exact' | 'within';
export type SortDir = 'asc' | 'desc';

export interface SearchParams {
  query: string;
  show: Show;
  set: string; // '' = all sets
  sort: SortKey;
  dir: SortDir;
  page: number;
  /** Extra Scryfall syntax added to every search, e.g. the format's legality. */
  filter?: string;
  /** W U B R G, or C for colorless. */
  colors?: string[];
  colorMode?: ColorMode;
  /** Card types, e.g. Creature. Any of them matches. */
  types?: string[];
  /** common / uncommon / rare / mythic. Any of them matches. */
  rarities?: string[];
}

const anyOf = (clauses: string[]) => (clauses.length > 1 ? `(${clauses.join(' or ')})` : clauses[0]);

/** The Color / Type / Rarity buttons as Scryfall syntax. */
function filterClauses({ colors = [], colorMode = 'any', types = [], rarities = [] }: SearchParams): string[] {
  const parts: string[] = [];
  if (colors.length) {
    const wubrg = colors.filter((c) => c !== 'C').join('').toLowerCase();
    if (colorMode === 'within') {
      // ci<=wubrg -ci:c, or with C picked colorless cards count too.
      if (!wubrg) parts.push('ci:c');
      else parts.push(colors.includes('C') ? `ci<=${wubrg}` : `ci<=${wubrg} -ci:c`);
    } else if (colorMode === 'any') parts.push(anyOf(colors.map((c) => `c:${c.toLowerCase()}`))); // c:c is colorless
    // "All" / "Exactly" with colorless picked alongside colors can't match anything, so colorless is ignored then.
    else if (!wubrg) parts.push('c:c');
    else parts.push(colorMode === 'all' ? `c>=${wubrg}` : `c=${wubrg}`);
  }
  if (types.length) parts.push(anyOf(types.map((t) => `t:${t.toLowerCase()}`)));
  if (rarities.length) parts.push(anyOf(rarities.map((r) => `r:${r}`)));
  return parts;
}

/** True when the search has something to look for (text, a set, or a filter button). */
export function hasSearch(params: SearchParams): boolean {
  return !!(params.query.trim() || params.set || filterClauses(params).length);
}

export interface SearchPage {
  cards: CardData[];
  total: number;
  hasMore: boolean;
}

export interface SetInfo {
  code: string;
  name: string;
  /** Set symbol (black SVG). */
  icon?: string;
  /** YYYY-MM-DD */
  released?: string;
  /** Scryfall set_type: core, expansion, masters, draft_innovation, ... */
  type?: string;
  digital?: boolean;
}

interface RawSet {
  code: string;
  name: string;
  icon_svg_uri?: string;
  released_at?: string;
  set_type?: string;
  digital?: boolean;
}

// ---- raw Scryfall shapes (only the fields we use) ----

interface RawFace {
  name: string;
  mana_cost?: string;
  type_line?: string;
  colors?: string[];
  image_uris?: { normal: string; small: string };
}

interface RawCard {
  id: string;
  oracle_id?: string;
  name: string;
  mana_cost?: string;
  cmc?: number;
  type_line?: string;
  colors?: string[];
  color_identity: string[];
  set: string;
  collector_number: string;
  image_uris?: { normal: string; small: string };
  card_faces?: RawFace[];
  legalities: Record<string, string>;
  prices: { usd?: string | null; usd_foil?: string | null; eur?: string | null; tix?: string | null };
  produced_mana?: string[];
  rarity?: string;
}

interface RawList<T> {
  data: T[];
  has_more?: boolean;
  total_cards?: number;
}

export function toCardData(raw: RawCard): CardData {
  const front = raw.card_faces?.[0];
  return {
    scryfallId: raw.id,
    oracleId: raw.oracle_id ?? raw.id,
    name: raw.name,
    manaCost: raw.mana_cost ?? front?.mana_cost ?? '',
    cmc: raw.cmc ?? 0,
    typeLine: raw.type_line ?? front?.type_line ?? '',
    colors: raw.colors ?? front?.colors ?? [],
    colorIdentity: raw.color_identity,
    set: raw.set,
    collectorNumber: raw.collector_number,
    imageKey: raw.image_uris?.normal ?? front?.image_uris?.normal ?? '',
    legalities: raw.legalities,
    producedMana: raw.produced_mana ?? [],
    rarity: raw.rarity,
    prices: {
      usd: raw.prices.usd ?? undefined,
      usdFoil: raw.prices.usd_foil ?? undefined,
      eur: raw.prices.eur ?? undefined,
      tix: raw.prices.tix ?? undefined,
    },
  };
}

const API = 'https://api.scryfall.com';

// Same pacing as the Rust client: 2 searches per second, ~10 other requests.
let browserQueue: Promise<unknown> = Promise.resolve();
let lastBrowserRequest = 0;
let blockedUntil = 0;

async function browserGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const turn = browserQueue.then(async () => {
    if (Date.now() < blockedUntil) throw new Error(`Scryfall asked Table to slow down. Searching again in ${Math.ceil((blockedUntil - Date.now()) / 1000)} s.`);
    const gap = path === '/cards/search' ? 550 : 100;
    const wait = lastBrowserRequest + gap - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastBrowserRequest = Date.now();
  });
  browserQueue = turn.catch(() => undefined);
  await turn;
  return browserFetch<T>(path, params);
}

async function browserFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`${API}${path}?${new URLSearchParams(params)}`, { headers: { Accept: 'application/json' } });
  if (res.status === 429) {
    blockedUntil = Date.now() + 60_000;
    throw new Error('Scryfall asked Table to slow down. Searching again in 60 s.');
  }
  if (res.status === 404 && path === '/cards/search') return { data: [], has_more: false, total_cards: 0 } as T;
  const body = await res.json();
  if (!res.ok) throw new Error(body?.details ?? `Scryfall error ${res.status}`);
  return body as T;
}

function buildQuery(params: SearchParams): string {
  const { query, set, filter } = params;
  const q = query.trim();
  const parts = [q && filter ? `(${q})` : q];
  if (set) parts.push(`set:${set}`);
  parts.push(...filterClauses(params));
  // Unique card / art: show the cheapest printing of each (Scryfall's prefer:), so its price is the lowest.
  if (params.show !== 'prints' && parts.some(Boolean)) parts.push('prefer:usd-low');
  // The filter only narrows a search; on its own it isn't one.
  if (filter && parts.some(Boolean)) parts.push(filter);
  return parts.filter(Boolean).join(' ');
}

export async function searchCards(params: SearchParams): Promise<SearchPage> {
  const q = buildQuery(params);
  if (!q) return { cards: [], total: 0, hasMore: false };
  const args = { query: q, unique: params.show, order: params.sort === 'type' || params.sort === 'identity' ? 'name' : params.sort, dir: params.dir, page: params.page };
  const raw = isTauri()
    ? await invoke<RawList<RawCard>>('scryfall_search', args)
    : await browserGet<RawList<RawCard>>('/cards/search', {
        q, unique: args.unique, order: args.order, dir: args.dir, page: String(args.page),
      });
  return { cards: raw.data.map(toCardData), total: raw.total_cards ?? raw.data.length, hasMore: !!raw.has_more };
}

let setsRequest: Promise<SetInfo[]> | null = null;

/** Every set, newest first. Fetched once per session. */
export function listSets(): Promise<SetInfo[]> {
  setsRequest ??= (async () => {
    const raw = isTauri() ? await invoke<RawList<RawSet>>('scryfall_sets') : await browserGet<RawList<RawSet>>('/sets', {});
    return raw.data.map((s) => ({
      code: s.code,
      name: s.name,
      icon: s.icon_svg_uri,
      released: s.released_at,
      type: s.set_type,
      digital: s.digital,
    }));
  })().catch((e) => {
    setsRequest = null; // try again next time
    throw e;
  });
  return setsRequest;
}
