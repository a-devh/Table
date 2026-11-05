// Which formats the deck on the table is legal in, for the Legality tab. This
// is a check only: it never changes the table's format.
import type { TableState } from '../model/types';
import { fenceOf } from '../model/derived';
import { checkDeck } from './deckCheck';
import type { Format } from './formats';

/** Sections that are never part of a deck, so any format allows them. */
const OUTSIDE_DECK = new Set(['Maybeboard']);

export interface FormatFit {
  format: Format;
  legal: boolean;
  /** Plain-language reasons it isn't legal. */
  reasons: string[];
}

export function formatFit(state: Pick<TableState, 'cards' | 'fences'>, format: Format, inLegalSets?: (oracleId: string) => boolean | undefined): FormatFit {
  const reasons: string[] = [];
  const zoneNames = new Set(format.zones.map((z) => z.name));
  // A section with cards that the format has no zone for (e.g. a Commander fence in Modern).
  const fences = Object.values(state.fences);
  const used = new Set<string>();
  for (const card of Object.values(state.cards)) {
    const section = fenceOf(card, fences)?.section;
    if (section && !OUTSIDE_DECK.has(section)) used.add(section);
  }
  for (const s of used) if (!zoneNames.has(s)) reasons.push(`No ${s} zone`);

  const check = checkDeck(state, format, (card) => inLegalSets?.(card.copies[0].data.oracleId));
  for (const z of check.zones) if (!z.ok) reasons.push(`${z.zone}: ${z.count}, needs ${z.rule} ${z.target}`);
  const byKind = new Map<string, Set<string>>();
  for (const [id, issues] of Object.entries(check.cardIssues)) {
    const name = state.cards[id]?.copies[0].data.name ?? '';
    for (const i of issues) byKind.set(i.kind, (byKind.get(i.kind) ?? new Set()).add(name));
  }
  const label: Record<string, string> = { banned: 'Banned', not_legal: 'Not legal', too_many: 'Too many copies' };
  for (const [kind, names] of byKind) reasons.push(`${label[kind] ?? kind}: ${[...names].join(', ')}`);
  return { format, legal: reasons.length === 0, reasons };
}
