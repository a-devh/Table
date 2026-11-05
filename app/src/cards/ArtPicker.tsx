// "Select art": every printing of a card, newest first. Picking one changes
// the card's printing wherever it is (table or side panel).
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CardData } from '../model/types';
import { searchCards } from '../search/scryfall';
import { useArtPicker } from './artPickerStore';
import ui from '../app/ui.module.css';
import styles from './ArtPicker.module.css';

export function ArtPicker() {
  const request = useArtPicker((s) => s.request);
  const close = useArtPicker((s) => s.close);
  const [prints, setPrints] = useState<CardData[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!request) return;
    let live = true;
    setPrints(null);
    setError(null);
    // One request: the first page (up to 175 printings) is plenty for nearly every card.
    searchCards({ query: `!"${request.name}" game:paper`, show: 'prints', set: '', sort: 'released', dir: 'desc', page: 1 })
      .then((page) => live && setPrints(page.cards))
      .catch((e: unknown) => live && setError(String(e instanceof Error ? e.message : e)));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => {
      live = false;
      window.removeEventListener('keydown', onKey);
    };
  }, [request, close]);

  if (!request) return null;
  return createPortal(
    <div className={ui.scrim} onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-label={`Select art for ${request.name}`} className={ui.dialog} style={{ width: 'min(760px, 100%)' }}>
        <header className={ui.dialogHeader}>
          <h2>{request.name}</h2>
          <button aria-label="Close" className={ui.iconButton} onClick={close}>
            ×
          </button>
        </header>
        {error && <p className={styles.note}>{error}</p>}
        {!prints && !error && <p className={styles.note}>Loading printings…</p>}
        {prints && (
          <div className={styles.grid}>
            {prints.map((p) => (
              <button
                key={p.scryfallId}
                className={styles.print}
                aria-pressed={p.scryfallId === request.current}
                title={`${p.set.toUpperCase()} ${p.collectorNumber}`}
                onClick={() => {
                  request.onPick(p);
                  close();
                }}
              >
                {p.imageKey ? <img src={p.imageKey.replace('/normal/', '/small/')} alt="" loading="lazy" /> : <span>{p.name}</span>}
                <small>
                  {p.set.toUpperCase()} · {p.collectorNumber}
                </small>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
