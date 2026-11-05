// Card legality for a format (pure functions), and the Scryfall syntax that
// limits a search to the format, so each search stays a single request.
import type { CardData } from '../model/types';
import type { Format } from './formats';

export type CardStatus = 'banned' | 'restricted' | 'not_legal' | null;

const legalIn = (card: CardData, key: string) => {
  const s = card.legalities?.[key];
  return s === 'legal' || s === 'restricted';
};

/** True when a custom format's set list matters for a card's legality. */
export const restrictsSets = (format: Format) => !!format.custom && format.sets.codes.length > 0;

/**
 * Scryfall clause matching printings the custom format's set list allows:
 * any of the extra legal sets, or anything outside the illegal sets.
 */
export function legalPrintingClause(format: Format): string {
  const { mode, codes } = format.sets;
  return mode === 'legal' ? `(${codes.map((c) => `e:${c}`).join(' or ')})` : codes.map((c) => `-e:${c}`).join(' ');
}

/**
 * Whether a card is banned, restricted or not legal in the format.
 * Built-in formats read Scryfall's legalities. Custom formats combine their
 * base format, their set list and their banned list; `inSetList` says whether
 * the card has a printing the set list allows (undefined = not known yet).
 */
export function cardStatus(card: CardData, format: Format, inSetList?: boolean): CardStatus {
  if (!format.custom) {
    if (!format.legality) return null;
    const status = card.legalities?.[format.legality];
    return status === 'banned' || status === 'restricted' || status === 'not_legal' ? status : null;
  }
  if (format.banned.some((b) => b.toLowerCase() === card.name.toLowerCase())) return 'banned';
  const base = format.legality;
  const baseStatus = base ? card.legalities?.[base] : undefined;
  if (baseStatus === 'banned') return 'banned';
  const restricted = baseStatus === 'restricted' ? 'restricted' : null;
  const sets = format.sets;
  if (sets.mode === 'legal') {
    // Base format's cards, plus anything printed in the extra sets.
    if (base && legalIn(card, base)) return restricted;
    if (!base && !sets.codes.length) return null; // no limits at all
    return inSetList === false || (!sets.codes.length && base) ? 'not_legal' : null;
  }
  // Illegal sets: base format's cards (or every card), minus cards only printed in those sets.
  if (base && !legalIn(card, base)) return 'not_legal';
  return inSetList === false ? 'not_legal' : restricted;
}

/**
 * Scryfall syntax limiting search results to cards playable in the format.
 * Banned and restricted cards stay in (they're shown with a badge).
 */
export function formatSearchFilter(format: Format): string {
  const key = format.legality;
  const base = key ? [`legal:${key}`, `banned:${key}`, ...(key === 'vintage' ? [`restricted:${key}`] : [])] : [];
  if (!format.custom) return base.length ? `(${base.join(' or ')})` : '';
  const { mode, codes } = format.sets;
  if (mode === 'legal') {
    const parts = [...base, ...codes.map((c) => `e:${c}`)];
    return parts.length ? `(${parts.join(' or ')})` : '';
  }
  return [base.length ? `(${base.join(' or ')})` : '', ...codes.map((c) => `-e:${c}`)].filter(Boolean).join(' ');
}
