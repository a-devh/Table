// Keeps the table and the local cards in step:
// - Every table offers every local tag, and tags made on a table become local.
// - A card that lands on a table (added, pasted, opened) takes its local tags.
// - Tagging a card on the table remembers it locally and tags the other copies
//   of that card (same printing) on the table the same way.
import { useTable } from '../model/store';
import type { Tag, TableCard } from '../model/types';
import { faceOf } from '../model/card';
import { useLocalCards, sameIds } from './localCards';

let syncing = false;

function sync() {
  if (syncing) return;
  syncing = true;
  try {
    const local = useLocalCards.getState();
    const t = useTable.getState();

    // Tags: both lists end up with all of them.
    for (const tag of Object.values(t.tags)) if (!local.tags[tag.id]) local.addTag(tag);
    const missing: Record<string, Tag> = {};
    for (const tag of Object.values(useLocalCards.getState().tags)) if (!t.tags[tag.id]) missing[tag.id] = tag;
    if (Object.keys(missing).length) useTable.setState((s) => ({ tags: { ...s.tags, ...missing } }));
  } finally {
    syncing = false;
  }
}

let known = new Map<string, string[]>(Object.entries(useTable.getState().cards).map(([id, c]) => [id, c.tagIds]));

/** Cards new to the table take their local tags; changed tags are remembered and shared by every copy on the table. */
function syncCards(cards: Record<string, TableCard>) {
  if (syncing) return;
  syncing = true;
  try {
    const local = useLocalCards.getState();
    const nextTags: Record<string, string[]> = {};
    const changedByPrinting = new Map<string, string[]>();
    for (const [id, card] of Object.entries(cards)) {
      const before = known.get(id);
      const data = faceOf(card);
      if (!before) {
        // New on the table: add what the app remembers.
        const remembered = local.cards[data.scryfallId]?.tagIds ?? [];
        const merged = [...new Set([...card.tagIds, ...remembered])];
        if (!sameIds(merged, card.tagIds)) nextTags[id] = merged;
        if (merged.length && !sameIds(merged, remembered)) local.setTags(data, merged);
      } else if (!sameIds(before, card.tagIds)) {
        changedByPrinting.set(data.scryfallId, card.tagIds);
        local.setTags(data, card.tagIds);
      }
    }
    // Other copies of a retagged card follow it.
    if (changedByPrinting.size) {
      for (const [id, card] of Object.entries(cards)) {
        const tagIds = changedByPrinting.get(faceOf(card).scryfallId);
        if (tagIds && !sameIds(tagIds, card.tagIds)) nextTags[id] = tagIds;
      }
    }
    if (Object.keys(nextTags).length) {
      useTable.setState((s) => {
        const next = { ...s.cards };
        for (const [id, tagIds] of Object.entries(nextTags)) if (next[id]) next[id] = { ...next[id], tagIds };
        return { cards: next };
      });
    }
  } finally {
    syncing = false;
  }
  known = new Map(Object.entries(useTable.getState().cards).map(([id, c]) => [id, c.tagIds]));
}

export function startLocalSync() {
  sync();
  syncCards(useTable.getState().cards);
  useTable.subscribe((s, prev) => {
    if (s.tags !== prev.tags) sync();
    if (s.cards !== prev.cards) syncCards(s.cards);
  });
  useLocalCards.subscribe((s, prev) => s.tags !== prev.tags && sync());
}
