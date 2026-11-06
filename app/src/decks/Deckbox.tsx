// A saved deck drawn as a chunky, rounded deck box (a "boulder" style case)
// in the deck's colors, with the cover card standing in front of it like a
// little display. The deck's name and size sit under the box.
import type { CSSProperties } from 'react';
import { useCachedImage } from '../cards/imageCache';
import type { DeckEntry } from './decksStore';
import styles from './Deckbox.module.css';

/** Box plastic per color of mana: [face, shadow side]. */
const SHADES: Record<string, [string, string]> = {
  W: ['#e8dfc4', '#b5a985'],
  U: ['#2f6db5', '#1c477c'],
  B: ['#3b3542', '#1d1a22'],
  R: ['#c4402e', '#82261a'],
  G: ['#2f7f4f', '#1b5131'],
};
const COLORLESS: [string, string] = ['#8f949c', '#5d626a'];

/** The plastic: one color, or the deck's colors blended across the box. */
function paint(colors: string[]): { face: string; side: string; lid: string } {
  const shades = colors.length ? colors.map((c) => SHADES[c] ?? COLORLESS) : [COLORLESS];
  const blend = (i: 0 | 1, angle: string) =>
    shades.length === 1 ? shades[0][i] : `linear-gradient(${angle}, ${shades.map((s, k) => `${s[i]} ${(k / (shades.length - 1)) * 100}%`).join(', ')})`;
  return { face: blend(0, '100deg'), side: blend(1, '180deg'), lid: blend(1, '100deg') };
}

export function Deckbox({ deck, open, onOpen, onDelete }: { deck: DeckEntry; open: boolean; onOpen: () => void; onDelete: () => void }) {
  const cover = useCachedImage(deck.cover?.imageKey);
  const p = paint(deck.colors);
  const vars = { '--face': p.face, '--side': p.side, '--lid': p.lid } as CSSProperties;
  return (
    <div className={styles.slot} data-open={open || undefined}>
      <button className={styles.hit} onClick={onOpen} aria-label={`Open ${deck.name}`} title={open ? `${deck.name} (on the table)` : `Open ${deck.name}`}>
        <div className={styles.stage} style={vars}>
          <div className={styles.box}>
            <div className={styles.top} />
            <div className={styles.side} />
            <div className={styles.front}>
              <div className={styles.lid} />
            </div>
          </div>
          {cover && <img className={styles.card} src={cover} alt="" draggable={false} />}
        </div>
        <span className={styles.name}>{deck.name}</span>
        <span className={styles.meta}>{deck.cardCount} cards</span>
      </button>
      <button className={styles.remove} aria-label={`Delete ${deck.name}`} title="Delete from library" onClick={onDelete}>
        ×
      </button>
    </div>
  );
}
