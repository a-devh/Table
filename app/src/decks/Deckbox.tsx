// A saved deck as one full-width tile: a two-piece hard deck case (the tall
// "Boulder" kind: a deep lid over the top of a slimmer body) molded in the
// deck's colors, with the cover card standing in front of it like a display.
// Name, format, colors and size sit beside it.
import type { CSSProperties } from 'react';
import { useCachedImage } from '../cards/imageCache';
import { ManaSymbol } from '../app/ManaSymbol';
import { findFormat } from '../rules/formats';
import { useFormats } from '../formats/formatsStore';
import type { DeckEntry } from './decksStore';
import styles from './Deckbox.module.css';

/** Case plastic per color of mana: [face, shadow side]. */
const SHADES: Record<string, [string, string]> = {
  W: ['#e9e1c8', '#b3a784'],
  U: ['#2f6db5', '#1c477c'],
  B: ['#3d3746', '#1d1a22'],
  R: ['#c4402e', '#82261a'],
  G: ['#2f7f4f', '#1b5131'],
};
const COLORLESS: [string, string] = ['#8f949c', '#5d626a'];

/** The plastic: one color, or the deck's colors blended across the case. */
function paint(colors: string[]) {
  const shades = colors.length ? colors.map((c) => SHADES[c] ?? COLORLESS) : [COLORLESS];
  const blend = (i: 0 | 1, angle: string) =>
    shades.length === 1 ? shades[0][i] : `linear-gradient(${angle}, ${shades.map((s, k) => `${s[i]} ${(k / (shades.length - 1)) * 100}%`).join(', ')})`;
  return { '--face': blend(0, '100deg'), '--side': blend(1, '180deg'), '--glow': shades[0][0] } as CSSProperties;
}

export function Deckbox({ deck, open, onOpen, onDelete }: { deck: DeckEntry; open: boolean; onOpen: () => void; onDelete: () => void }) {
  const cover = useCachedImage(deck.cover?.imageKey);
  const custom = useFormats((s) => s.custom);
  const format = deck.format && deck.format !== 'none' ? findFormat(deck.format, custom).label : null;
  return (
    <div className={styles.slot} data-open={open || undefined} style={paint(deck.colors)}>
      <button className={styles.hit} onClick={onOpen} aria-label={`Open ${deck.name}`} title={open ? `${deck.name} (on the table)` : `Open ${deck.name}`}>
        <div className={styles.scene}>
          <div className={styles.stage}>
            <div className={styles.side} />
            <div className={styles.top} />
            <div className={styles.body} />
            <div className={styles.lid} />
          </div>
          {cover && <img className={styles.card} src={cover} alt="" draggable={false} />}
        </div>
        <span className={styles.info}>
          <span className={styles.name}>{deck.name}</span>
          {format && <span className={styles.meta}>{format}</span>}
          <span className={styles.meta}>{deck.cardCount} cards</span>
          {deck.colors.length > 0 && (
            <span className={styles.pips}>
              {deck.colors.map((c) => (
                <ManaSymbol key={c} color={c} size={18} />
              ))}
            </span>
          )}
          {open && <span className={styles.badge}>On the table</span>}
        </span>
      </button>
      <button className={styles.remove} aria-label={`Delete ${deck.name}`} title="Delete from library" onClick={onDelete}>
        ×
      </button>
    </div>
  );
}
