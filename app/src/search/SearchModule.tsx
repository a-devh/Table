// Search module: query, Show / Set / Sort controls, and a paginated results
// grid. Each result is a card object (the same kind as on the table), shown
// with the shared CardTile. In Search it can't move; dragging it, or +, puts a
// copy on the table.
import { useEffect, useRef, useState } from 'react';
import { hasSearch, listSets, searchCards, type SearchParams, type SetInfo } from './scryfall';
import { primaryType, TYPE_ORDER } from '../rules/cardTypes';
import { SearchControls } from './SearchControls';
import { useCurrentFormat } from '../formats/formatsStore';
import { cardStatus, formatSearchFilter } from '../rules/legality';
import type { Card } from '../model/types';
import { faceOf, makeCard } from '../model/card';
import { addToTable } from '../board/addToTable';
import { CardTile, type CardAbilities } from '../cards/CardTile';
import { useSettings } from '../settings/settingsStore';
import ui from '../app/ui.module.css';
import panel from '../app/Modules.module.css';
import styles from './SearchModule.module.css';

/** What a card can do in Search: come out onto the table, but not move around. */
const SEARCH_ABILITIES: CardAbilities = { drag: true, pick: true, step: true, caption: true, local: true };

export function SearchModule() {
  const [draft, setDraft] = useState('');
  const [params, setParams] = useState<SearchParams>({
    query: '',
    show: 'cards',
    set: '',
    sort: 'name',
    dir: 'asc',
    page: 1,
  });
  const [results, setResults] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  // Results picked with Shift+click (card ids); dragging one brings them all.
  const [picked, setPicked] = useState<string[]>([]);
  const format = useCurrentFormat();
  const [sets, setSets] = useState<SetInfo[]>([]);
  useEffect(() => {
    listSets()
      .then(setSets)
      .catch(() => setSets([]));
  }, []);

  // Results only include cards playable in the format; switching formats re-runs the search.
  const filter = formatSearchFilter(format);
  useEffect(() => {
    setParams((p) => (p.filter === filter ? p : { ...p, filter, page: 1 }));
  }, [filter]);

  // Debounce typing into the query.
  useEffect(() => {
    const t = setTimeout(() => setParams((p) => (p.query === draft ? p : { ...p, query: draft, page: 1 })), 400);
    return () => clearTimeout(t);
  }, [draft]);

  useEffect(() => {
    const id = ++requestId.current;
    if (!hasSearch(params)) {
      setResults([]);
      setTotal(0);
      setHasMore(false);
      setError(null);
      return;
    }
    setLoading(true);
    // A short wait so clicking several filter buttons in a row sends one search.
    const timer = window.setTimeout(
      () =>
        searchCards(params)
          .then((page) => {
            if (id !== requestId.current) return;
            const cards = page.cards.map(makeCard);
            setResults((prev) => (params.page === 1 ? cards : [...prev, ...cards]));
            if (params.page === 1) setPicked([]);
            setTotal(page.total);
            setHasMore(page.hasMore);
            setError(null);
          })
          .catch((e: unknown) => id === requestId.current && setError(String(e instanceof Error ? e.message : e)))
          .finally(() => id === requestId.current && setLoading(false)),
      params.page === 1 ? 250 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [params]);

  // The search itself only returns cards playable in the format (see the filter
  // above), so results only need the banned / restricted check.
  const statusOf = (card: Card) => cardStatus(faceOf(card), format);

  const columns = useSettings((s) => s.searchLayout.columns);
  const panelWidth = useSettings((s) => s.searchLayout.panelWidth);
  // Rough width of one result tile, so the browser can pick the right image size.
  const tileWidth = Math.round((panelWidth - 32 - (columns - 1) * 10) / columns);

  // Scryfall can't sort by type or color identity: those results come by name,
  // and the loaded ones are ordered here (names stay in order within a rank).
  const typeRank = (c: Card) => {
    const i = TYPE_ORDER.indexOf(primaryType(faceOf(c).typeLine));
    return i < 0 ? TYPE_ORDER.length : i;
  };
  const rank = params.sort === 'type' ? typeRank : params.sort === 'identity' ? identityRank : null;
  const shown = rank ? [...results].sort((a, b) => (rank(a) - rank(b)) * (params.dir === 'asc' ? 1 : -1)) : results;

  const update = (patch: Partial<SearchParams>) => setParams((p) => ({ ...p, ...patch, page: 1 }));

  return (
    <>
      <div className={styles.header}>
        <h2 className={panel.title}>Search</h2>
        {total > 0 && <span className={styles.count}>{total.toLocaleString()} results</span>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update({ query: draft });
        }}
      >
        <label>
          <span className={ui.visuallyHidden}>Search cards</span>
          <input
            className={ui.input}
            style={{ width: '100%', height: 40 }}
            placeholder="Card name or Scryfall syntax"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
      </form>
      <SearchControls params={params} sets={sets} update={update} />

      <div className={styles.results}>
        {error && <p className={styles.error}>{error}</p>}
        {!error && !loading && results.length === 0 && hasSearch(params) && <p className={panel.placeholder}>No cards found.</p>}

        {picked.length > 0 && (
          <div className={styles.pickBar} role="status">
            <span>{picked.length} selected</span>
            <button
              className={ui.button}
              onClick={() => {
                addToTable(results.filter((c) => picked.includes(c.id)));
                setPicked([]);
              }}
            >
              Add to table
            </button>
            <button className={ui.button} onClick={() => setPicked([])}>
              Clear
            </button>
          </div>
        )}

        <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {shown.map((card) => {
            const isPicked = picked.includes(card.id);
            return (
              <CardTile
                key={card.id}
                card={card}
                can={SEARCH_ABILITIES}
                status={statusOf(card)}
                formatLabel={format.label}
                width={tileWidth}
                picked={isPicked}
                onPick={() => setPicked((p) => (isPicked ? p.filter((id) => id !== card.id) : [...p, card.id]))}
                // Dragging a selected card brings every selected card; otherwise just this one.
                dragGroup={() => (isPicked ? results.filter((c) => picked.includes(c.id)) : [card])}
                onDragOut={() => isPicked && setPicked([])}
                // Select art trades this result for a new card object; Set tag changes it in place.
                onChange={(next) => {
                  setResults((list) => list.map((c) => (c.id === card.id ? next : c)));
                  if (next.id !== card.id) setPicked((p) => p.map((id) => (id === card.id ? next.id : id)));
                }}
              />
            );
          })}
        </div>

        {hasMore && (
          <button className={ui.button} disabled={loading} onClick={() => setParams((p) => ({ ...p, page: p.page + 1 }))}>
            {loading ? 'Loading…' : 'Load more'}
          </button>
        )}
        {loading && !hasMore && <p className={panel.placeholder}>Searching…</p>}
      </div>
    </>
  );
}

/**
 * Color identity order: mono W U B R G, then two colors, three and so on
 * (each in WUBRG order), colorless last.
 */
function identityRank(c: Card): number {
  const ci = faceOf(c).colorIdentity;
  if (!ci.length) return 1e6;
  const bits = ci.reduce((n, x) => n | (1 << (4 - 'WUBRG'.indexOf(x))), 0);
  return ci.length * 100 + (31 - bits);
}
