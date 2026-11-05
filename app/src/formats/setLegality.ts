// For custom formats with a set rule: whether a card has a printing in a legal
// set. Asks Scryfall in batches of oracle ids and caches answers for the
// session. Used by search results and the deck check.
import { create } from 'zustand';
import { searchCards } from '../search/scryfall';
import type { Format } from '../rules/formats';
import { legalPrintingClause, restrictsSets } from '../rules/legality';

const BATCH = 30;
const known = new Map<string, boolean>(); // `${formatKey}|${oracleId}` -> in a legal set
const pending = new Set<string>();

/** Bumped whenever new answers arrive, so views can re-check. */
export const useSetLegalityVersion = create<{ version: number }>()(() => ({ version: 0 }));

const formatKey = (f: Format) => `${f.id}:${f.legality ?? ''}:${f.sets.mode}:${f.sets.codes.join(',')}`;

/** true / false once known; undefined while unknown or when the format has no set rule. */
export function inLegalSets(format: Format, oracleId: string): boolean | undefined {
  return restrictsSets(format) ? known.get(`${formatKey(format)}|${oracleId}`) : undefined;
}

/** Look up any of these cards not known yet. */
export async function ensureSetLegality(format: Format, oracleIds: string[]): Promise<void> {
  if (!restrictsSets(format)) return;
  const key = formatKey(format);
  const missing = [...new Set(oracleIds)].filter((id) => id && !known.has(`${key}|${id}`) && !pending.has(`${key}|${id}`));
  if (!missing.length) return;
  missing.forEach((id) => pending.add(`${key}|${id}`));
  try {
    const clause = legalPrintingClause(format);
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      const query = `(${batch.map((id) => `oracleid:${id}`).join(' or ')}) ${clause}`;
      const legal = new Set<string>();
      for (let page = 1; page <= 5; page++) {
        const result = await searchCards({ query, show: 'cards', set: '', sort: 'name', dir: 'asc', page });
        result.cards.forEach((c) => legal.add(c.oracleId));
        if (!result.hasMore) break;
      }
      batch.forEach((id) => known.set(`${key}|${id}`, legal.has(id)));
    }
  } catch {
    // Offline: leave them unknown (treated as legal) and try again later.
  } finally {
    missing.forEach((id) => pending.delete(`${key}|${id}`));
    useSetLegalityVersion.setState((s) => ({ version: s.version + 1 }));
  }
}
