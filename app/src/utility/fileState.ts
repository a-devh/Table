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
import { confirmDiscard, fileNameFor, pickTableFile, saveTextFile } from './fileIO';

type Snapshot = Pick<TableState, 'cards' | 'fences' | 'tags' | 'deckName' | 'format'>;

interface FileState {
  path: string | null;
  saved: Snapshot;
  error: string | null;
  setError: (error: string | null) => void;
}

const snapshot = (s: TableState): Snapshot => ({ cards: s.cards, fences: s.fences, tags: s.tags, deckName: s.deckName, format: s.format });

export const useFileState = create<FileState>()((set) => ({
  path: null,
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

const markSaved = (path: string | null) => useFileState.setState({ path, saved: snapshot(useTable.getState()), error: null });

async function okToDiscard(): Promise<boolean> {
  if (!isDirty(useTable.getState(), useFileState.getState().saved)) return true;
  return confirmDiscard('This table has unsaved changes. Discard them?');
}

async function run(action: () => Promise<void>) {
  try {
    await action();
  } catch (e) {
    useFileState.getState().setError(e instanceof Error ? e.message : String(e));
  }
}

export const newTable = () =>
  run(async () => {
    if (!(await okToDiscard())) return;
    useTable.getState().loadTable(null);
    clearHistory();
    markSaved(null);
  });

export const openTable = () =>
  run(async () => {
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
  run(async () => {
    const state = useTable.getState();
    const format = currentFormat();
    const path = await saveTextFile(toTableFile(state, format.custom ? format : undefined), {
      path: saveAs ? null : useFileState.getState().path,
      suggestedName: fileNameFor(state.deckName, 'table'),
      kind: 'table',
    });
    if (path) markSaved(path);
  });
