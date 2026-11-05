// The printings inside a merged card, shown while hovering it.
import { useTable } from '../model/store';
import { pileTop } from '../model/card';
import type { CardData } from '../model/types';
import { useCachedImage } from '../cards/imageCache';
import { priceLabel } from '../rules/prices';
import { usePeek } from './peekStore';
import styles from './CardMenu.module.css';

export function MergedPeek() {
  const peek = usePeek((s) => s.peek);
  const card = useTable((t) => (peek ? t.cards[peek.cardId] : undefined));
  if (!peek || !card || card.copies.length < 2) return null;

  // One row per printing, with how many copies of it.
  const rows = new Map<string, { data: CardData; n: number }>();
  for (const c of card.copies) {
    const row = rows.get(c.data.scryfallId);
    if (row) row.n++;
    else rows.set(c.data.scryfallId, { data: c.data, n: 1 });
  }
  const left = Math.min(peek.x + 16, window.innerWidth - 280);
  const top = Math.min(peek.y + 16, window.innerHeight - 60 - rows.size * 52);

  return (
    <div className={styles.peek} style={{ left, top }} role="tooltip">
      <div className={styles.peekTitle}>
        {pileTop(card)?.name ?? 'Mixed pile'} <span>×{card.copies.length}</span>
      </div>
      {[...rows.values()].map(({ data, n }) => (
        <PeekRow key={data.scryfallId} data={data} n={n} />
      ))}
    </div>
  );
}

function PeekRow({ data, n }: { data: CardData; n: number }) {
  const src = useCachedImage(data.imageKey ? data.imageKey.replace('/normal/', '/small/') : undefined);
  const price = priceLabel(data);
  return (
    <div className={styles.peekRow}>
      {src ? <img src={src} alt="" /> : <span className={styles.peekThumb} />}
      <span>
        {data.set.toUpperCase()} #{data.collectorNumber}
        {price && <small> {price}</small>}
      </span>
      <b>×{n}</b>
    </div>
  );
}
