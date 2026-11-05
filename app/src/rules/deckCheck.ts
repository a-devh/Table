// Deck legality: zone counts, banned / not legal cards, and the copy limit.
// Only cards in fences whose section is one of the format's zones are part of
// the deck; Maybeboard, other sections and loose (Misc.) cards are ignored.
import type { TableCard, TableState } from '../model/types';
import { fenceOf, mergeCount } from '../model/derived';
import type { Format } from './formats';
import { cardStatus } from './legality';

export type IssueKind = 'banned' | 'not_legal' | 'too_many';

export interface Issue {
  kind: IssueKind;
  text: string;
}

export interface ZoneCount {
  zone: string;
  count: number;
  target: number;
  /** The first zone (library) is a minimum, or exact in singleton formats; other zones are a maximum. */
  rule: 'at least' | 'exactly' | 'at most';
  ok: boolean;
}

export interface DeckCheck {
  /** Card id -> problems with that card. */
  cardIssues: Record<string, Issue[]>;
  zones: ZoneCount[];
  /** Number of things wrong: distinct card names with issues + zones off count. */
  problems: number;
}

export const EMPTY_CHECK: DeckCheck = { cardIssues: {}, zones: [], problems: 0 };

const isBasic = (card: TableCard) => /\bBasic\b/.test(card.copies[0].data.typeLine);

export function checkDeck(state: Pick<TableState, 'cards' | 'fences'>, format: Format, inLegalSets: (card: TableCard) => boolean | undefined): DeckCheck {
  if (format.id === 'none') return EMPTY_CHECK;
  const zoneNames = new Set(format.zones.map((z) => z.name));
  const fences = Object.values(state.fences);
  const counts = new Map<string, number>();
  const deck: TableCard[] = [];
  for (const card of Object.values(state.cards)) {
    const section = fenceOf(card, fences)?.section;
    if (!section || !zoneNames.has(section)) continue;
    deck.push(card);
    counts.set(section, (counts.get(section) ?? 0) + mergeCount(card));
  }

  const zones: ZoneCount[] = format.zones.map((z, i) => {
    const count = counts.get(z.name) ?? 0;
    const rule = i > 0 ? 'at most' : format.maxCopies === 1 ? 'exactly' : 'at least';
    const ok = rule === 'at most' ? count <= z.count : rule === 'exactly' ? count === z.count : count >= z.count;
    return { zone: z.name, count, target: z.count, rule, ok };
  });

  // Copies of each card name across the whole deck.
  const copies = new Map<string, number>();
  for (const card of deck) {
    const name = card.copies[0].data.name;
    copies.set(name, (copies.get(name) ?? 0) + mergeCount(card));
  }

  const cardIssues: Record<string, Issue[]> = {};
  for (const card of deck) {
    const data = card.copies[0].data;
    const issues: Issue[] = [];
    const status = cardStatus(data, format, inLegalSets(card));
    if (status === 'banned') issues.push({ kind: 'banned', text: `Banned in ${format.label}` });
    if (status === 'not_legal') issues.push({ kind: 'not_legal', text: `Not legal in ${format.label}` });
    const limit = status === 'restricted' ? 1 : format.maxCopies;
    const n = copies.get(data.name) ?? 0;
    if (!isBasic(card) && n > limit) {
      issues.push({ kind: 'too_many', text: `${n} copies; ${status === 'restricted' ? 'restricted to 1' : limit === 1 ? 'singleton' : `limit ${limit}`}` });
    }
    if (issues.length) cardIssues[card.id] = issues;
  }

  const badNames = new Set(deck.filter((c) => cardIssues[c.id]).map((c) => c.copies[0].data.name));
  return { cardIssues, zones, problems: badNames.size + zones.filter((z) => !z.ok).length };
}
