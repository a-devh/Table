// Hovering a merged card for a moment shows which printings it holds.
import { create } from 'zustand';

interface PeekState {
  peek: { cardId: string; x: number; y: number } | null;
  show: (cardId: string, x: number, y: number) => void;
  hide: () => void;
}

export const usePeek = create<PeekState>()((set, get) => ({
  peek: null,
  show: (cardId, x, y) => set({ peek: { cardId, x, y } }),
  hide: () => get().peek && set({ peek: null }),
}));
