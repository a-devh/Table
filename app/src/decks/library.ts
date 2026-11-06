// Saving the table into the deck library and opening decks from it.
import type { CardData, TableCard, TableState } from '../model/types';
import { fenceOf } from '../model/derived';
import { newId } from '../model/ids';
import { useTable } from '../model/store';
import { parseTableFile, toTableFile } from '../model/tableFile';
import { clearHistory } from '../history/history';
import { currentFormat, useFormats } from '../formats/formatsStore';
import { confirmAction } from '../utility/fileIO';
import { markSaved, okToDiscard, runFileAction, useFileState } from '../utility/fileState';
import { readDeck, removeDeck, writeDeck } from './deckStorage';
import { useDecks, type DeckEntry } from './decksStore';

const WUBRG = ['W', 'U', 'B', 'R', 'G'];
const OUTSIDE_DECK = new Set(['Maybeboard']);

/** The cards that make up the deck: those in the format's sections, or every card if there are no fences. */
function deckCards(s: Pick<TableState, 'cards' | 'fences'>): TableCard[] {
  const cards = Object.values(s.cards);
  const fences = Object.values(s.fences);
  if (!fences.some((f) => !f.parentId)) return cards;
  return cards.filter((c) => {
    const section = fenceOf(c, fences)?.section;
    return section && !OUTSIDE_DECK.has(section);
  });
}

/** The box's cover: the picked card if it's still in the deck, else the commander, else the highest mana value nonland. */
function chooseCover(s: Pick<TableState, 'cards' | 'fences'>, picked: string | undefined): CardData | undefined {
  const all = Object.values(s.cards).flatMap((c) => c.copies.map((k) => k.data));
  const pick = picked && all.find((d) => d.scryfallId === picked);
  if (pick) return pick;
  const fences = Object.values(s.fences);
  const cards = deckCards(s);
  const commander = cards.find((c) => /commander/i.test(fenceOf(c, fences)?.section ?? ''));
  if (commander) return commander.copies[0].data;
  const spells = cards.map((c) => c.copies[0].data).filter((d) => !/\bLand\b/.test(d.typeLine));
  return spells.sort((a, b) => b.cmc - a.cmc)[0] ?? cards[0]?.copies[0].data;
}

export function summarize(s: TableState, id: string, picked: string | undefined): DeckEntry {
  const cards = deckCards(s);
  const colors = new Set(cards.flatMap((c) => c.copies[0].data.colorIdentity));
  const cover = chooseCover(s, picked);
  return {
    id,
    name: s.deckName.trim() || 'Untitled deck',
    format: s.format,
    colors: WUBRG.filter((c) => colors.has(c)),
    cover: cover && { scryfallId: cover.scryfallId, imageKey: cover.imageKey, name: cover.name },
    pickedCover: picked,
    cardCount: cards.reduce((n, c) => n + c.copies.length, 0),
    updatedAt: Date.now(),
  };
}

/** Save the table into the library: over the deck it came from, or as a new deck. */
export const saveToLibrary = (asNew = false) =>
  runFileAction(async () => {
    const state = useTable.getState();
    const file = useFileState.getState();
    const id = (!asNew && file.deckId && useDecks.getState().decks[file.deckId] && file.deckId) || newId('deck');
    const format = currentFormat();
    await writeDeck(id, toTableFile(state, format.custom ? format : undefined));
    useDecks.getState().put(summarize(state, id, file.deckCover));
    markSaved(asNew ? null : file.path, id, file.deckCover);
  });

export const openFromLibrary = (id: string) =>
  runFileAction(async () => {
    if (useFileState.getState().deckId === id) return;
    if (!(await okToDiscard())) return;
    const text = await readDeck(id);
    if (!text) throw new Error('That deck is missing from the library.');
    const { state, customFormat } = parseTableFile(text);
    if (customFormat && !useFormats.getState().custom[customFormat.id]) useFormats.getState().saveFormat(customFormat);
    useTable.getState().loadTable(state);
    clearHistory();
    markSaved(null, id, useDecks.getState().decks[id]?.pickedCover);
  });

export const deleteFromLibrary = (id: string) =>
  runFileAction(async () => {
    const name = useDecks.getState().decks[id]?.name ?? 'this deck';
    if (!(await confirmAction(`Delete "${name}" from the library? This can't be undone.`, 'Delete deck', 'Delete'))) return;
    await removeDeck(id);
    useDecks.getState().remove(id);
    // The table keeps its cards; it just isn't that library deck any more.
    if (useFileState.getState().deckId === id) useFileState.setState({ deckId: null });
  });

/** Use a card as the cover of the deck on the table (saved with the deck). */
export function setDeckCover(data: CardData) {
  useFileState.setState({ deckCover: data.scryfallId });
  const id = useFileState.getState().deckId;
  const entry = id && useDecks.getState().decks[id];
  if (entry) useDecks.getState().put({ ...entry, pickedCover: data.scryfallId, cover: { scryfallId: data.scryfallId, imageKey: data.imageKey, name: data.name } });
}
