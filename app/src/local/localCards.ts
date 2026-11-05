// Local cards: what the app remembers about a card across every table, saved
// in the app (not in .table files). A card is one printing (Scryfall's most
// specific id), so entries are keyed by Scryfall id. A local card is the same
// card object used everywhere plus what we track for it. An entry is dropped
// once nothing is set on it.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Card, CardData, Tag } from '../model/types';
import { faceOf, makeCard } from '../model/card';

export interface LocalCard extends Card {
  favorited: boolean;
  wishlisted: boolean;
  /** Copies of this printing in your collection. */
  owned: number;
}

interface LocalCardsState {
  cards: Record<string, LocalCard>;
  /** The tag list, shared by every table. */
  tags: Record<string, Tag>;
  addTag: (tag: Tag) => void;
  /** Set a card's tags (an empty list clears them). */
  setTags: (data: CardData, tagIds: string[]) => void;
  setFavorited: (data: CardData, on: boolean) => void;
  setWishlisted: (data: CardData, on: boolean) => void;
  /** Add (or with a negative count, remove) owned copies. */
  addOwned: (data: CardData, count: number) => void;
}

const isEmpty = (c: LocalCard) => !c.tagIds.length && !c.favorited && !c.wishlisted && c.owned <= 0;

/** The local card for this printing, or a new blank one. */
const entryFor = (cards: Record<string, LocalCard>, data: CardData): LocalCard =>
  cards[data.scryfallId] ?? { ...makeCard(data), favorited: false, wishlisted: false, owned: 0 };

/** Store an entry, or drop it when nothing is set on it any more. */
function put(cards: Record<string, LocalCard>, entry: LocalCard): Record<string, LocalCard> {
  const next = { ...cards };
  const key = faceOf(entry).scryfallId;
  if (isEmpty(entry)) delete next[key];
  else next[key] = entry;
  return next;
}

export const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));

interface OracleEntryV1 extends Card {
  favorited: boolean;
  wishlisted: boolean;
  owned: Record<string, number>;
}

/** Version 1 kept one entry per card (any printing); split it into one per printing. */
function fromV1(cards: Record<string, OracleEntryV1>): Record<string, LocalCard> {
  let next: Record<string, LocalCard> = {};
  for (const old of Object.values(cards)) {
    old.copies.forEach((copy, i) => {
      const shown = i === 0;
      next = put(next, {
        id: shown ? old.id : `${old.id}-${copy.data.scryfallId}`,
        copies: [copy],
        tagIds: shown ? old.tagIds : [],
        favorited: shown && old.favorited,
        wishlisted: shown && old.wishlisted,
        owned: old.owned[copy.data.scryfallId] ?? 0,
      });
    });
  }
  return next;
}

export const useLocalCards = create<LocalCardsState>()(
  persist(
    (set) => ({
      cards: {},
      tags: {},
      addTag: (tag) => set((s) => (s.tags[tag.id] ? {} : { tags: { ...s.tags, [tag.id]: tag } })),
      setTags: (data, tagIds) =>
        set((s) => {
          const entry = entryFor(s.cards, data);
          if (sameIds(entry.tagIds, tagIds)) return {};
          return { cards: put(s.cards, { ...entry, tagIds: [...tagIds] }) };
        }),
      setFavorited: (data, favorited) => set((s) => ({ cards: put(s.cards, { ...entryFor(s.cards, data), favorited }) })),
      setWishlisted: (data, wishlisted) => set((s) => ({ cards: put(s.cards, { ...entryFor(s.cards, data), wishlisted }) })),
      addOwned: (data, count) =>
        set((s) => {
          const entry = entryFor(s.cards, data);
          return { cards: put(s.cards, { ...entry, owned: Math.max(0, entry.owned + count) }) };
        }),
    }),
    {
      name: 'table-local-cards',
      version: 2,
      migrate: (saved, version) => {
        const state = saved as { cards: Record<string, unknown>; tags: Record<string, Tag> };
        if (version < 2) return { ...state, cards: fromV1(state.cards as Record<string, OracleEntryV1>) };
        return state;
      },
    },
  ),
);

/** What the app remembers about this printing, if anything. */
export const localCardOf = (data: CardData): LocalCard | undefined => useLocalCards.getState().cards[data.scryfallId];
