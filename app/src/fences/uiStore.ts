// Session-only fence UI state (not part of the table or the .table file).
import { create } from 'zustand';

/** A fence that has been drawn but not yet given a section. */
export interface PendingFence {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Where to show the section picker, in board (screen) pixels. */
  screenX: number;
  screenY: number;
}

export type AnalyticsSection = 'all' | 'cmc' | 'types' | 'pips' | 'identity' | 'sources' | 'legality';

export const ANALYTICS_SECTIONS: { value: AnalyticsSection; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'cmc', label: 'CMC' },
  { value: 'types', label: 'Types' },
  { value: 'pips', label: 'Pips' },
  { value: 'identity', label: 'Color Identity' },
  { value: 'sources', label: 'Mana sources' },
  { value: 'legality', label: 'Legality' },
];

interface FenceUi {
  /** Open analytics panels: fence id -> section shown. Pinned panels live on the fence itself. */
  analytics: Record<string, AnalyticsSection>;
  openAnalytics: (fenceId: string, section: AnalyticsSection) => void;
  closeAnalytics: (fenceId: string) => void;
  pending: PendingFence | null;
  /** Fence under the pointer on the table. */
  hoveredFenceId: string | null;
  setPending: (p: PendingFence | null) => void;
  setHovered: (id: string | null) => void;
}

export const useFenceUi = create<FenceUi>()((set) => ({
  pending: null,
  hoveredFenceId: null,
  analytics: {},
  openAnalytics: (id, section) => set((s) => ({ analytics: { ...s.analytics, [id]: section } })),
  closeAnalytics: (id) =>
    set((s) => {
      const analytics = { ...s.analytics };
      delete analytics[id];
      return { analytics };
    }),
  setPending: (pending) => set({ pending }),
  setHovered: (hoveredFenceId) => set({ hoveredFenceId }),
}));
