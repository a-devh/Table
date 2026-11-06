// Making and copying card objects. Every place that holds cards (Search,
// Favorites, Collection, the table) uses these, so a card is the same object
// everywhere.
import type { Card, CardData } from './types';
import { newId } from './ids';

/** A new card object with one copy of this printing. */
export function makeCard(data: CardData): Card {
  return { id: newId('card'), copies: [{ copyId: newId('copy'), data }], tagIds: [] };
}

/** A copy of a card object to put somewhere else (new ids, same printings and tags). */
export function cloneCard(card: Card): Card {
  return { id: newId('card'), copies: card.copies.map((c) => ({ copyId: newId('copy'), data: c.data })), tagIds: [...card.tagIds] };
}

/** The printing shown for a card (its first copy). */
export const faceOf = (card: Card): CardData => card.copies[0].data;
export const nameOf = (card: Card): string => faceOf(card).name;

/** True when a card has a back face to flip to (double-faced cards). */
export const canFlip = (card: Card): boolean => !!faceOf(card).back;

/** The image showing for a printing: its back face when flipped (and it has one), else its front. */
export const shownImage = (data: CardData, flipped: boolean | undefined): string =>
  (flipped && data.back?.imageKey) || data.imageKey;

/**
 * The printing shown on top of a merged pile: the last copy in it when every
 * copy has the same name, or null (show the Magic card back) when the pile
 * mixes different cards. A single card shows its own printing.
 */
export function pileTop(card: Card): CardData | null {
  const last = card.copies[card.copies.length - 1].data;
  return card.copies.every((c) => c.data.name === last.name) ? last : null;
}
/**
 * A card's identity: its printing (Scryfall id, the most specific thing
 * Scryfall has). Two card objects of the same printing are the same card.
 * Game rules (copy limits, legality) still go by name.
 */
export const printingOf = (card: Card): string => faceOf(card).scryfallId;

/** A new card object that trades this one for another printing: same number of copies and tags, new ids. */
export function swapCard(card: Card, data: CardData): Card {
  return { id: newId('card'), copies: card.copies.map(() => ({ copyId: newId('copy'), data })), tagIds: [...card.tagIds] };
}
