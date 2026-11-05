// The current deck's legality, kept up to date as the table, the format or
// set-legality answers change. The board (Pixi) and React views both read it.
import { create } from 'zustand';
import { useTable } from '../model/store';
import { checkDeck, EMPTY_CHECK, type DeckCheck } from '../rules/deckCheck';
import { currentFormat, useFormats } from './formatsStore';
import { ensureSetLegality, inLegalSets, useSetLegalityVersion } from './setLegality';

export const useDeckCheck = create<DeckCheck>()(() => EMPTY_CHECK);

let lastKey = '';

function recheck() {
  const state = useTable.getState();
  const format = currentFormat();
  const cards = Object.values(state.cards);
  // In "extra legal sets" mode, cards legal in the base format need no lookup.
  const base = format.legality;
  const needLookup = cards.filter((c) => {
    const s = base ? c.copies[0].data.legalities?.[base] : undefined;
    return !(format.sets.mode === 'legal' && (s === 'legal' || s === 'restricted'));
  });
  ensureSetLegality(
    format,
    needLookup.map((c) => c.copies[0].data.oracleId),
  );
  const result = checkDeck(state, format, (card) => inLegalSets(format, card.copies[0].data.oracleId));
  // Only publish real changes, so dragging a card doesn't re-render everything.
  const key = JSON.stringify(result);
  if (key !== lastKey) {
    lastKey = key;
    useDeckCheck.setState(result, true);
  }
}

let lastCards = useTable.getState().cards;
let lastFences = useTable.getState().fences;
let lastFormat = useTable.getState().format;
useTable.subscribe((s) => {
  if (s.cards === lastCards && s.fences === lastFences && s.format === lastFormat) return; // camera, selection, ...
  lastCards = s.cards;
  lastFences = s.fences;
  lastFormat = s.format;
  recheck();
});
useFormats.subscribe(recheck);
useSetLegalityVersion.subscribe(recheck);
recheck();
