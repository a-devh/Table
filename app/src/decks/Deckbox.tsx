// A saved deck drawn as a deckbox: a 3D box in the deck's colors, with the
// cover card's art in a window on the front and the deck's name below it.
import type { CSSProperties } from 'react';
import { useCachedImage } from '../cards/imageCache';
import type { DeckEntry } from './decksStore';
import styles from './Deckbox.module.css';

/** Box colors per color of mana: [main, darker edge]. */
const SHADES: Record<string, [string, string]> = {
  W: ['#e9e0c4', '#b9ad8a'],
  U: ['#2f6db5', '#1d4a80'],
  B: ['#3a3440', '#1f1b24'],
  R: ['#c2412f', '#86271b'],
  G: ['#2f7f4f', '#1c5532'],
};
const COLORLESS: [string, string] = ['#8d929b', '#5f646c'];

/** The box's paint: one color, or bands of each of the deck's colors. */
function paint(colors: string[]): { front: string; side: string; top: string; ink: string } {
  const shades = colors.length ? colors.map((c) => SHADES[c] ?? COLORLESS) : [COLORLESS];
  const bands = (i: 0 | 1, angle: string) =>
    shades.length === 1
      ? shades[0][i]
      : `linear-gradient(${angle}, ${shades.map((s, k) => `${s[i]} ${Math.max(0, (k / shades.length) * 100 + 6)}% ${Math.min(100, ((k + 1) / shades.length) * 100 - 6)}%`).join(', ')})`;
  const light = colors.length === 1 && colors[0] === 'W';
  return { front: bands(0, '90deg'), side: bands(1, '180deg'), top: bands(1, '90deg'), ink: light ? '#2b2620' : '#f6f2ea' };
}

export function Deckbox({ deck, open, onOpen, onDelete }: { deck: DeckEntry; open: boolean; onOpen: () => void; onDelete: () => void }) {
  const art = useCachedImage(deck.cover?.imageKey);
  const p = paint(deck.colors);
  const vars = { '--front': p.front, '--side': p.side, '--top': p.top, '--ink': p.ink } as CSSProperties;
  return (
    <div className={styles.slot} data-open={open || undefined}>
      <button className={styles.hit} onClick={onOpen} aria-label={`Open ${deck.name}`} title={open ? `${deck.name} (on the table)` : `Open ${deck.name}`}>
        <div className={styles.box} style={vars}>
          <div className={styles.top} />
          <div className={styles.side} />
          <div className={styles.front}>
            <div className={styles.window}>{art ? <img src={art} alt="" draggable={false} /> : <span>{deck.cover?.name ?? ''}</span>}</div>
            <div className={styles.lid} />
            <div className={styles.label}>
              <span className={styles.name}>{deck.name}</span>
              <span className={styles.meta}>{deck.cardCount} cards</span>
            </div>
          </div>
        </div>
      </button>
      <button className={styles.remove} aria-label={`Delete ${deck.name}`} title="Delete from library" onClick={onDelete}>
        ×
      </button>
    </div>
  );
}
