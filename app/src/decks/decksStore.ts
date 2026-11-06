// The deck library's index: one small entry per saved deck, enough to draw its
// deckbox without loading the deck. The deck itself is in deckStorage.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DeckEntry {
  id: string;
  name: string;
  format: string;
  /** Color identity of the deck (WUBRG order); empty = colorless. */
  colors: string[];
  /** The card on the box's front: its printing and image. */
  cover?: { scryfallId: string; imageKey: string; name: string };
  /** The cover the user picked (a Scryfall id); otherwise one is chosen. */
  pickedCover?: string;
  cardCount: number;
  updatedAt: number;
}

interface DecksState {
  decks: Record<string, DeckEntry>;
  put: (entry: DeckEntry) => void;
  remove: (id: string) => void;
}

export const useDecks = create<DecksState>()(
  persist(
    (set) => ({
      decks: {},
      put: (entry) => set((s) => ({ decks: { ...s.decks, [entry.id]: entry } })),
      remove: (id) =>
        set((s) => {
          const decks = { ...s.decks };
          delete decks[id];
          return { decks };
        }),
    }),
    { name: 'table-decks', version: 1 },
  ),
);
