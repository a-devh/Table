// Search Scryfall by name and pick cards from a scrolling result list.
// Clicking a result toggles it in the picked list.
import { useEffect, useState } from 'react';
import { searchCards } from '../search/scryfall';
import type { CardData } from '../model/types';
import ui from '../app/ui.module.css';
import styles from './formats.module.css';

export function CardPicker({ picked, onToggle, label }: { picked: string[]; onToggle: (name: string) => void; label: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CardData[]>([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setStatus('');
      return;
    }
    let live = true;
    const timer = window.setTimeout(() => {
      setStatus('Searching…');
      searchCards({ query: q, show: 'cards', set: '', sort: 'name', dir: 'asc', page: 1 })
        .then((page) => live && (setResults(page.cards), setStatus(page.cards.length ? '' : 'No cards found.')))
        .catch(() => live && (setResults([]), setStatus("Couldn't reach Scryfall.")));
    }, 300);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const isPicked = (name: string) => picked.some((p) => p.toLowerCase() === name.toLowerCase());

  return (
    <div className={styles.picker}>
      <input aria-label={label} className={ui.input} placeholder="Search card names" value={query} onChange={(e) => setQuery(e.target.value)} />
      {(results.length > 0 || status) && (
        <div role="listbox" aria-label={`${label} results`} className={styles.list}>
          {status && <div className={styles.empty}>{status}</div>}
          {results.map((c) => (
            <button key={c.oracleId || c.scryfallId} type="button" role="option" aria-selected={isPicked(c.name)} className={styles.cardRow} onClick={() => onToggle(c.name)}>
              <span className={styles.check}>{isPicked(c.name) ? '✓' : ''}</span>
              <span className={styles.setName}>{c.name}</span>
              <span className={styles.setMeta}>{c.typeLine}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
