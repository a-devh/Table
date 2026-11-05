// State for the card right-click menu, plus the Delete key shortcut.
// The same menu serves cards on the table and cards in a side panel.
import { useEffect } from 'react';
import { create } from 'zustand';
import { useTable } from '../model/store';
import type { Card } from '../model/types';

export type MenuTarget =
  /** Cards on the table (the clicked card, plus the selection it's in). */
  | { kind: 'table'; cardIds: string[] }
  /** A card in a side panel; `onChange` updates it there (art, tags). */
  | { kind: 'panel'; card: Card; onChange?: (card: Card) => void };

interface CardMenuState {
  menu: { x: number; y: number; target: MenuTarget } | null;
  open: (x: number, y: number, cardIds: string[]) => void;
  openPanel: (x: number, y: number, card: Card, onChange?: (card: Card) => void) => void;
  close: () => void;
}

export const useCardMenu = create<CardMenuState>()((set) => ({
  menu: null,
  open: (x, y, cardIds) => set({ menu: { x, y, target: { kind: 'table', cardIds } } }),
  openPanel: (x, y, card, onChange) => set({ menu: { x, y, target: { kind: 'panel', card, onChange } } }),
  close: () => set({ menu: null }),
}));

/** Delete/Backspace removes the selected cards (ignored while typing). */
export function useDeleteKey() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const t = useTable.getState();
      if (!t.selection.length) return;
      e.preventDefault();
      t.removeCards(t.selection);
      useCardMenu.getState().close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
