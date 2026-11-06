// Which file the table came from, and whether it has unsaved changes.
// "Unsaved" is derived: the saved parts of the state are compared, by
// reference, with the snapshot taken at the last New/Open/Save.
import { create } from 'zustand';
import { useTable } from '../model/store';
import { parseTableFile, toTableFile } from '../model/tableFile';
import type { TableState } from '../model/types';
import { clearHistory } from '../history/history';
import { currentFormat, useFormats } from '../formats/formatsStore';
import { isTauri } from '@tauri-apps/api/core';
import { saveToLibrary as saveLibraryDeck } from '../decks/library';
import { confirmDiscard, fileNameFor, pickTableFile, saveTextFile } from './fileIO';

type Snapshot = Pick<TableState, 'cards' | 'fences' | 'tags' | 'deckName' | 'format'>;

interface FileState {
  path: string | null;
  /** The library deck the table was opened from or saved to, if any. */
  deckId: string | null;
  /** The card picked as that deck's box cover (Scryfall id). */
  deckCover?: string;
  saved: Snapshot;
  error: string | null;
  setError: (error: string | null) => void;
}

const snapshot = (s: TableState): Snapshot => ({ cards: s.cards, fences: s.fences, tags: s.tags, deckName: s.deckName, format: s.format });

export const useFileState = create<FileState>()((set) => ({
  path: null,
  deckId: null,
  saved: snapshot(useTable.getState()),
  error: null,
  setError: (error) => set({ error }),
}));

export function isDirty(table: TableState, saved: Snapshot): boolean {
  return (Object.keys(saved) as (keyof Snapshot)[]).some((k) => table[k] !== saved[k]);
}

// In a browser tab, warn before closing or reloading with unsaved changes.
if (!isTauri()) {
  window.addEventListener('beforeunload', (e) => {
    if (isDirty(useTable.getState(), useFileState.getState().saved)) e.preventDefault();
  });
}

/** Remember what the table now matches: a file, a library deck, or neither. */
export const markSaved = (path: string | null, deckId: string | null = null, deckCover?: string) =>
  useFileState.setState({ path, deckId, deckCover, saved: snapshot(useTable.getState()), error: null });

export async function okToDiscard(): Promise<boolean> {
  if (!isDirty(useTable.getState(), useFileState.getState().saved)) return true;
  return confirmDiscard('This table has unsaved changes. Discard them?');
}

export async function runFileAction(action: () => Promise<void>) {
  try {
    await action();
  } catch (e) {
    useFileState.getState().setError(e instanceof Error ? e.message : String(e));
  }
}

export const newTable = () =>
  runFileAction(async () => {
    if (!(await okToDiscard())) return;
    useTable.getState().loadTable(null);
    clearHistory();
    markSaved(null);
  });

export const openTable = () =>
  runFileAction(async () => {
    if (!(await okToDiscard())) return;
    const file = await pickTableFile();
    if (!file) return;
    const { state, customFormat } = parseTableFile(file.text);
    // Keep a custom format we don't have yet; never overwrite one we already have.
    if (customFormat && !useFormats.getState().custom[customFormat.id]) useFormats.getState().saveFormat(customFormat);
    useTable.getState().loadTable(state);
    clearHistory();
    markSaved(file.path);
  });

/** Save to the current file, or ask where when there isn't one (or for Save As). */
export const saveTable = (saveAs = false) =>
  runFileAction(async () => {
    const { deckId, path: current } = useFileState.getState();
    if (deckId && !current && !saveAs) return saveLibraryDeck();
    const state = useTable.getState();
    const format = currentFormat();
    const path = await saveTextFile(toTableFile(state, format.custom ? format : undefined), {
      path: saveAs ? null : useFileState.getState().path,
      suggestedName: fileNameFor(state.deckName, 'table'),
      kind: 'table',
    });
    const f = useFileState.getState();
    if (path) markSaved(path, saveAs ? null : f.deckId, saveAs ? undefined : f.deckCover);
  });
