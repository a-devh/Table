// Card types in the order the app lists them (fence Type view, search filter and sort).
export const TYPE_ORDER = ['Creature', 'Planeswalker', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Battle', 'Land'];

/** The type a card is grouped under: the first of TYPE_ORDER in its type line. */
export function primaryType(typeLine: string): string {
  return TYPE_ORDER.find((t) => typeLine.includes(t)) ?? 'Other';
}
