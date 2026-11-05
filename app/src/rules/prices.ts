// Card prices as shown in the app. Scryfall gives prices as strings and
// leaves them out when nobody sells that printing.
import type { CardData } from '../model/types';

/** "$0.25", or null when there's no USD price (falls back to foil). */
export function priceLabel(data: CardData): string | null {
  const usd = data.prices.usd ?? data.prices.usdFoil;
  return usd ? `$${usd}` : null;
}

/** Every price Scryfall has for the printing, for the right-click menu. */
export function allPrices(data: CardData): { label: string; value: string }[] {
  const p = data.prices;
  return [
    p.usd && { label: 'USD', value: `$${p.usd}` },
    p.usdFoil && { label: 'USD foil', value: `$${p.usdFoil}` },
    p.eur && { label: 'EUR', value: `€${p.eur}` },
    p.tix && { label: 'MTGO', value: `${p.tix} tix` },
  ].filter(Boolean) as { label: string; value: string }[];
}

/** The printing's page on Scryfall. */
export function scryfallUrl(data: CardData): string {
  return `https://scryfall.com/card/${data.set}/${encodeURIComponent(data.collectorNumber)}`;
}
