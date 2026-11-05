// Custom formats made with Add Format. Saved in the app (not per table); a
// .table file that uses one also carries a copy so it opens anywhere.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useTable } from '../model/store';
import { findFormat, type Format } from '../rules/formats';

interface FormatsState {
  custom: Record<string, Format>;
  saveFormat: (format: Format) => void;
  deleteFormat: (id: string) => void;
}

export const useFormats = create<FormatsState>()(
  persist(
    (set) => ({
      custom: {},
      saveFormat: (format) => set((s) => ({ custom: { ...s.custom, [format.id]: { ...format, custom: true } } })),
      deleteFormat: (id) =>
        set((s) => {
          const custom = { ...s.custom };
          delete custom[id];
          return { custom };
        }),
    }),
    { name: 'table-formats', version: 1 },
  ),
);

/** The current table's format, built-in or custom. */
export function useCurrentFormat(): Format {
  const id = useTable((s) => s.format);
  const custom = useFormats((s) => s.custom);
  return findFormat(id, custom);
}

export const currentFormat = (): Format => findFormat(useTable.getState().format, useFormats.getState().custom);
