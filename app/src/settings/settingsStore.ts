// App settings (not part of any .table file). Kept in the webview's local
// storage so they survive restarts.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ManaMathSettings } from '../rules/analytics';

export interface SearchLayout {
  /** Result cards per row. */
  columns: number;
  /** Side panel width in pixels. */
  panelWidth: number;
}

export type ThemeChoice = 'system' | 'dark' | 'light';
export type Accent = 'default' | 'amber' | 'green' | 'violet' | 'rose';
/** Table color family: the original Table colors, or Material Design 3's baseline palette. */
export type Palette = 'table' | 'material';
/** How the snap grid is drawn on the table. */
export type GridPattern = 'dots' | 'fine' | 'lines' | 'none';

interface Settings {
  /** Dark, light, or follow the operating system. */
  theme: ThemeChoice;
  setTheme: (theme: ThemeChoice) => void;
  accent: Accent;
  setAccent: (accent: Accent) => void;
  palette: Palette;
  setPalette: (palette: Palette) => void;
  gridPattern: GridPattern;
  setGridPattern: (pattern: GridPattern) => void;
  manaMath: ManaMathSettings;
  setManaMath: (patch: Partial<ManaMathSettings>) => void;
  /** Snap dropped cards to the table grid (stacking works either way). */
  gridSnap: boolean;
  setGridSnap: (on: boolean) => void;
  /** Show each card's price on table cards (off by default). Search results always show it. */
  tablePrices: boolean;
  setTablePrices: (on: boolean) => void;
  searchLayout: SearchLayout;
  setSearchLayout: (patch: Partial<SearchLayout>) => void;
}

export const PANEL_WIDTH = { min: 260, max: 720, initial: 300 };

export const DEFAULT_MANA_MATH: ManaMathSettings = { castChance: 0.9, onTheDraw: false };

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
      accent: 'default',
      setAccent: (accent) => set({ accent }),
      palette: 'table',
      setPalette: (palette) => set({ palette }),
      gridPattern: 'dots',
      setGridPattern: (gridPattern) => set({ gridPattern }),
      manaMath: DEFAULT_MANA_MATH,
      setManaMath: (patch) => set((s) => ({ manaMath: { ...s.manaMath, ...patch } })),
      gridSnap: true,
      setGridSnap: (gridSnap) => set({ gridSnap }),
      tablePrices: false,
      setTablePrices: (tablePrices) => set({ tablePrices }),
      searchLayout: { columns: 2, panelWidth: PANEL_WIDTH.initial },
      setSearchLayout: (patch) => set((s) => ({ searchLayout: { ...s.searchLayout, ...patch } })),
    }),
    { name: 'table-settings', version: 1 },
  ),
);
