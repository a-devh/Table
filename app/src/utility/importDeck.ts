// Import a pasted deck list: look the cards up on Scryfall, lay the deck out on
// a new table (one fence per section, sorted by mana value) and keep it in the
// deck library.
import { useTable } from '../model/store';
import { makeCard } from '../model/card';
import { CARD_HEIGHT, CARD_WIDTH } from '../model/derived';
import type { CardData } from '../model/types';
import { applyFenceView } from '../fences/actions';
import { GRID } from '../fences/layout';
import { parseDeckList } from '../rules/importList';
import { lookupCards } from '../search/scryfall';
import { clearHistory } from '../history/history';
import { saveToLibrary } from '../decks/library';
import { markSaved, okToDiscard } from './fileState';

const SECTION_ORDER = ['Commander', 'Main', 'Sideboard', 'Maybeboard'];

export interface ImportResult {
  cards: number;
  /** Lines Scryfall didn't recognise, as written in the list. */
  missing: string[];
}

/** Returns null when the user kept the current table instead. */
export async function importDeckList(text: string, deckName: string): Promise<ImportResult | null> {
  const sections = parseDeckList(text);
  if (!sections.length) throw new Error('No cards found in that list. Lines look like "4 Lightning Bolt".');
  if (!(await okToDiscard())) return null;

  const entries = sections.flatMap((s) => s.entries.map((e) => ({ section: s.name, ...e })));
  const found = await lookupCards(entries);
  const missing = entries.filter((_, i) => !found[i]).map((e) => `${e.count} ${e.name}${e.set ? ` (${e.set.toUpperCase()})` : ''}`);

  const bySection = new Map<string, CardData[]>();
  entries.forEach((e, i) => {
    const data = found[i];
    if (!data) return;
    const list = bySection.get(e.section) ?? [];
    for (let n = 0; n < e.count; n++) list.push(data);
    bySection.set(e.section, list);
  });
  if (!bySection.size) throw new Error(`Scryfall didn't recognise any of those cards (${missing.slice(0, 3).join(', ')}…).`);

  const t = useTable.getState();
  const isCommander = bySection.has('Commander');
  t.loadTable({ deckName: deckName.trim() || 'Imported deck', format: isCommander ? 'commander' : 'none', cards: {}, fences: {}, tags: {}, camera: { x: 80, y: 80, zoom: 0.35 } });

  // Fences side by side, left to right: Commander, Main, Sideboard, Maybeboard, then anything else.
  const rank = (n: string) => (SECTION_ORDER.includes(n) ? SECTION_ORDER.indexOf(n) : 50);
  let x = 0;
  let count = 0;
  for (const [name, cards] of [...bySection.entries()].sort((a, b) => rank(a[0]) - rank(b[0]))) {
    const fenceId = useTable.getState().drawFence(x, 0, CARD_WIDTH + 2 * GRID, CARD_HEIGHT + 2 * GRID, name, name);
    for (const data of cards) useTable.getState().addCard(makeCard(data), x + GRID, GRID);
    count += cards.length;
    applyFenceView(fenceId, 'cmc');
    const fence = useTable.getState().fences[fenceId];
    x = fence.x + fence.width + 2 * GRID;
  }
  useTable.getState().select([]);
  clearHistory();
  markSaved(null);
  await saveToLibrary(true);
  return { cards: count, missing };
}
