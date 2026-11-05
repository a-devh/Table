// Which card the Select art dialog is open for (see ArtPicker.tsx).
import { create } from 'zustand';
import type { CardData } from '../model/types';

interface ArtPickerState {
  request: { name: string; current: string; onPick: (data: CardData) => void } | null;
  open: (name: string, current: string, onPick: (data: CardData) => void) => void;
  close: () => void;
}

export const useArtPicker = create<ArtPickerState>()((set) => ({
  request: null,
  open: (name, current, onPick) => set({ request: { name, current, onPick } }),
  close: () => set({ request: null }),
}));
