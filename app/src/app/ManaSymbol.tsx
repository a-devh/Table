// Card symbols drawn with the bundled Mana and Keyrune icon fonts (they look
// like the symbols on real cards and work offline): mana pips, card types and
// rarity.
const NAMES: Record<string, string> = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' };

/** A mana pip (W U B R G C). */
export function ManaSymbol({ color, size = 16 }: { color: string; size?: number }) {
  const name = NAMES[color] ?? color;
  return <i className={`ms ms-${color.toLowerCase()} ms-cost ms-shadow`} style={{ fontSize: size * 0.8 }} role="img" aria-label={name} title={name} />;
}

/** A card type icon, e.g. Creature. */
export function TypeSymbol({ type, size = 16 }: { type: string; size?: number }) {
  return <i className={`ms ms-${type.toLowerCase()} ms-fw`} style={{ fontSize: size }} aria-hidden />;
}

/** A rarity icon: the Magic symbol in the rarity's color. */
export function RaritySymbol({ rarity, size = 16 }: { rarity: string; size?: number }) {
  return <i className={`ss ss-bcore ss-${rarity} ss-grad ss-fw`} style={{ fontSize: size }} aria-hidden />;
}
