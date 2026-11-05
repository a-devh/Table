// Deck analytics for a set of cards. Pure functions: cards in, numbers out.
// Every count uses copies, so a merged "9x Island" counts as nine.
import { mergeCount } from '../model/derived';
import type { TableCard } from '../model/types';
import { TYPE_ORDER as TYPES } from './cardTypes';

export const MANA_COLORS = ['W', 'U', 'B', 'R', 'G'] as const;
export type ManaColor = (typeof MANA_COLORS)[number];

export interface Bar {
  label: string;
  value: number;
  /** X spells that could be cast for this much (CMC chart only). */
  potential?: number;
}

/** How many {X} a mana cost has (0 for most cards). */
export const xCount = (manaCost: string): number => (manaCost.match(/\{X\}/g) ?? []).length;

const BASIC_LAND_COLOR: Record<string, ManaColor> = { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' };

const isLand = (c: TableCard) => /\bLand\b/.test(c.copies[0].data.typeLine);

/**
 * Mana value curve of the non-land cards, one bar per mana value from 0 up to
 * the highest (at least 7). X spells have no fixed value: they count as
 * "potential" on every value they can be cast for, from their cost with X = 1
 * up in steps of their number of X ({X}: every value, {X}{X}: every 2nd,
 * {X}{X}{X}: every 3rd). The average leaves X spells out.
 */
export function cmcCurve(cards: TableCard[]): { bars: Bar[]; average: number } {
  const spells = cards.filter((c) => !isLand(c));
  const firm = spells.filter((c) => !xCount(c.copies[0].data.manaCost));
  const top = Math.max(7, ...firm.map((c) => Math.floor(c.copies[0].data.cmc)));
  const bars: Bar[] = Array.from({ length: top + 1 }, (_, i) => ({ label: String(i), value: 0, potential: 0 }));
  let total = 0;
  let count = 0;
  for (const c of spells) {
    const d = c.copies[0].data;
    const n = mergeCount(c);
    const x = xCount(d.manaCost);
    if (x) {
      for (let v = Math.floor(d.cmc) + x; v <= top; v += x) bars[v].potential! += n;
      continue;
    }
    bars[Math.floor(d.cmc)].value += n;
    total += d.cmc * n;
    count += n;
  }
  return { bars, average: count ? total / count : 0 };
}

/** Cards per card type. An Artifact Creature counts as both. */
export function typeCounts(cards: TableCard[]): Bar[] {
  return TYPES.map((label) => ({
    label,
    value: cards.filter((c) => c.copies[0].data.typeLine.includes(label)).reduce((n, c) => n + mergeCount(c), 0),
  })).filter((b) => b.value > 0);
}

/** Colored pips in one mana cost. Hybrid {W/U} counts half to each; {W/P} and {2/W} count fully. */
export function pipsInCost(cost: string): Record<ManaColor, number> {
  const pips: Record<ManaColor, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const [, symbol] of cost.matchAll(/\{([^}]+)\}/g)) {
    const colors = symbol.split('/').filter((p): p is ManaColor => (MANA_COLORS as readonly string[]).includes(p));
    for (const color of colors) pips[color] += 1 / colors.length;
  }
  return pips;
}

/** Total colored pips across all mana costs. */
export function pipCounts(cards: TableCard[]): Record<ManaColor, number> {
  const total: Record<ManaColor, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const c of cards) {
    const pips = pipsInCost(c.copies[0].data.manaCost);
    for (const color of MANA_COLORS) total[color] += pips[color] * mergeCount(c);
  }
  return total;
}

/** Cards whose color identity includes each color, plus colorless cards. */
export function identityCounts(cards: TableCard[]): Record<ManaColor | 'C', number> {
  const counts: Record<ManaColor | 'C', number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  for (const c of cards) {
    const identity = c.copies[0].data.colorIdentity;
    const n = mergeCount(c);
    if (!identity.length) counts.C += n;
    for (const color of identity) if (color in counts) counts[color as ManaColor] += n;
  }
  return counts;
}

// ---- mana sources (Frank Karsten's method) ---------------------------------

const logFactorials: number[] = [0];
function logFactorial(n: number): number {
  for (let i = logFactorials.length; i <= n; i++) logFactorials[i] = logFactorials[i - 1] + Math.log(i);
  return logFactorials[n];
}
const logChoose = (n: number, k: number) => logFactorial(n) - logFactorial(k) - logFactorial(n - k);

/** Chance of at least `need` sources among `drawn` cards from a deck of `deck` with `sources` sources. */
function atLeast(deck: number, sources: number, drawn: number, need: number): number {
  let miss = 0;
  for (let k = 0; k < need; k++) {
    if (k > sources || drawn - k > deck - sources || drawn - k < 0) continue;
    miss += Math.exp(logChoose(sources, k) + logChoose(deck - sources, drawn - k) - logChoose(deck, drawn));
  }
  return 1 - miss;
}

/** Settings for the mana math (Settings > Mana math). */
export interface ManaMathSettings {
  /** How often the hardest spell of each color should be castable on curve (0.9 = 90%). */
  castChance: number;
  /** On the draw sees one more card by each turn than on the play. */
  onTheDraw: boolean;
}

/**
 * Fewest sources of one color needed to have `pips` of them by `turn`
 * (hypergeometric, as in Frank Karsten's articles, without his mulligan
 * adjustment, so it runs a little higher than his published tables).
 */
export function sourcesNeeded(deckSize: number, pips: number, turn: number, math: ManaMathSettings): number {
  const drawn = Math.min(deckSize, 6 + turn + (math.onTheDraw ? 1 : 0));
  for (let s = pips; s <= deckSize; s++) if (atLeast(deckSize, s, drawn, pips) >= math.castChance) return s;
  return deckSize;
}

export interface SourceNeed {
  color: ManaColor;
  /** Sources needed for the hardest card of this color to cast. */
  need: number;
  /** Lands that make this color. A dual or triome counts for every color it makes. */
  have: number;
  hardest: string;
}

function landColors(c: TableCard): string[] {
  const d = c.copies[0].data;
  if (d.producedMana?.length) return d.producedMana;
  return Object.entries(BASIC_LAND_COLOR).filter(([type]) => d.typeLine.includes(type)).map(([, color]) => color);
}

export function manaSources(cards: TableCard[], deckSize: number, math: ManaMathSettings): SourceNeed[] {
  const result: SourceNeed[] = [];
  for (const color of MANA_COLORS) {
    let need = 0;
    let hardest = '';
    for (const c of cards) {
      if (isLand(c)) continue;
      const d = c.copies[0].data;
      // Hybrid pips can be paid with the other color, so only firm pips count here.
      const firm = [...d.manaCost.matchAll(/\{([^}]+)\}/g)].filter(([, s]) => s === color || s === `${color}/P` || s === `2/${color}`).length;
      if (!firm) continue;
      const n = sourcesNeeded(deckSize, firm, Math.max(1, Math.ceil(d.cmc), firm), math);
      if (n > need) {
        need = n;
        hardest = d.name;
      }
    }
    if (!need) continue;
    const have = cards.filter((c) => isLand(c) && landColors(c).includes(color)).reduce((n, c) => n + mergeCount(c), 0);
    result.push({ color, need, have, hardest });
  }
  return result;
}
