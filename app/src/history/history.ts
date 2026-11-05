// Undo/redo for the table. History holds snapshots of the saved parts of the
// state (cards, fences, tags, deck name, format); camera, selection and tool
// are not undoable. Snapshots are cheap because state is never mutated, so a
// snapshot is just a handful of references.
//
// Changes are grouped into one step: everything while a pointer button is held
// (a whole drag), or a burst of changes with no pause longer than GROUP_MS
// (e.g. typing a deck name).
import { create } from 'zustand';
import { useTable } from '../model/store';
import type { TableState } from '../model/types';

type Snapshot = Pick<TableState, 'cards' | 'fences' | 'tags' | 'deckName' | 'format'>;

const LIMIT = 200;
const GROUP_MS = 400;

const snapshot = (s: TableState): Snapshot => ({ cards: s.cards, fences: s.fences, tags: s.tags, deckName: s.deckName, format: s.format });
const changed = (a: TableState, b: TableState) =>
  a.cards !== b.cards || a.fences !== b.fences || a.tags !== b.tags || a.deckName !== b.deckName || a.format !== b.format;

interface History {
  past: Snapshot[];
  future: Snapshot[];
}

export const useHistory = create<History>()(() => ({ past: [], future: [] }));

let applying = false;
let groupOpen = false;
let groupTimer: number | undefined;
let pointerHeld = false;

function closeGroupSoon() {
  window.clearTimeout(groupTimer);
  groupTimer = window.setTimeout(() => {
    if (!pointerHeld) groupOpen = false;
  }, GROUP_MS);
}

useTable.subscribe((state, prev) => {
  if (applying || !changed(state, prev)) return;
  if (!groupOpen) {
    groupOpen = true;
    useHistory.setState((h) => ({ past: [...h.past, snapshot(prev)].slice(-LIMIT), future: [] }));
  }
  closeGroupSoon();
});

window.addEventListener('pointerdown', () => (pointerHeld = true), true);
window.addEventListener(
  'pointerup',
  () => {
    pointerHeld = false;
    closeGroupSoon();
  },
  true,
);

function apply(target: Snapshot) {
  applying = true;
  useTable.setState((s) => ({
    ...target,
    // Drop selected cards that no longer exist.
    selection: s.selection.filter((id) => target.cards[id]),
  }));
  applying = false;
  groupOpen = false;
}

export function undo() {
  const { past, future } = useHistory.getState();
  const previous = past[past.length - 1];
  if (!previous) return;
  const current = snapshot(useTable.getState());
  useHistory.setState({ past: past.slice(0, -1), future: [...future, current] });
  apply(previous);
}

export function redo() {
  const { past, future } = useHistory.getState();
  const next = future[future.length - 1];
  if (!next) return;
  const current = snapshot(useTable.getState());
  useHistory.setState({ past: [...past, current], future: future.slice(0, -1) });
  apply(next);
}

/** Start fresh (New / Open): earlier tables can't be undone into. */
export function clearHistory() {
  groupOpen = false;
  useHistory.setState({ past: [], future: [] });
}
