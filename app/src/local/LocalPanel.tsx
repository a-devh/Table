// The Favorites and Collection panels: local cards shown with the shared
// CardTile, like Search results. Drag or + puts a copy on the table; drop table
// cards on the panel to add them here.
import { useEffect, useState } from 'react';
import type { Card } from '../model/types';
import { faceOf, nameOf } from '../model/card';
import { CardTile, type CardAbilities } from '../cards/CardTile';
import { useSettings } from '../settings/settingsStore';
import { useCurrentFormat } from '../formats/formatsStore';
import { cardStatus } from '../rules/legality';
import { useLocalCards, type LocalCard } from './localCards';
import { setOpenLocalView, type LocalView } from './openView';
import ui from '../app/ui.module.css';
import panel from '../app/Modules.module.css';
import search from '../search/SearchModule.module.css';
import styles from './LocalPanel.module.css';

const ABILITIES: CardAbilities = { drag: true, step: true, caption: true, local: true };

/** One tile per card (printing); Owned shows how many you have. */
function tilesOf(cards: LocalCard[], view: LocalView): { card: Card; count?: number }[] {
  return cards.map((c) => ({ card: { id: c.id, copies: c.copies, tagIds: c.tagIds }, count: view === 'owned' ? c.owned : undefined }));
}

/** Select art in Favorites or Wishlist: trade this card for the other printing in that list. */
function trade(view: LocalView, from: Card, to: Card) {
  const local = useLocalCards.getState();
  if (view === 'favorites') {
    local.setFavorited(faceOf(from), false);
    local.setFavorited(faceOf(to), true);
  } else if (view === 'wishlist') {
    local.setWishlisted(faceOf(from), false);
    local.setWishlisted(faceOf(to), true);
  }
}

export function LocalPanel({ title, views }: { title: string; views: { view: LocalView; label: string; empty: string }[] }) {
  const [view, setView] = useState<LocalView>(views[0].view);
  const [filter, setFilter] = useState('');
  const all = useLocalCards((s) => s.cards);
  const format = useCurrentFormat();
  const columns = useSettings((s) => s.searchLayout.columns);
  const panelWidth = useSettings((s) => s.searchLayout.panelWidth);
  const tileWidth = Math.round((panelWidth - 32 - (columns - 1) * 10) / columns);

  const current = views.find((v) => v.view === view) ?? views[0];
  useEffect(() => setOpenLocalView(current.view), [current.view]);
  const list = Object.values(all).filter((c) => (view === 'favorites' ? c.favorited : view === 'wishlist' ? c.wishlisted : c.owned > 0));
  const needle = filter.trim().toLowerCase();
  const tiles = tilesOf(list, view)
    .filter((t) => !needle || nameOf(t.card).toLowerCase().includes(needle))
    .sort((a, b) => nameOf(a.card).localeCompare(nameOf(b.card)) || faceOf(a.card).set.localeCompare(faceOf(b.card).set));
  const total = tiles.reduce((n, t) => n + (t.count ?? 1), 0);

  return (
    <>
      <div className={search.header}>
        <h2 className={panel.title}>{title}</h2>
        {total > 0 && <span className={search.count}>{view === 'owned' ? `${total} owned` : `${total} cards`}</span>}
      </div>
      {views.length > 1 && (
        <div role="tablist" className={styles.tabs}>
          {views.map((v) => (
            <button key={v.view} role="tab" aria-selected={v.view === view} className={styles.tab} onClick={() => setView(v.view)}>
              {v.label}
            </button>
          ))}
        </div>
      )}
      <input
        className={ui.input}
        placeholder="Filter by name"
        aria-label={`Filter ${current.label}`}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className={search.results}>
        {!tiles.length && <p className={panel.placeholder}>{needle ? 'No cards match.' : current.empty}</p>}
        <div className={search.grid} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {tiles.map(({ card, count }) => (
            <CardTile
              key={card.id}
              card={card}
              can={ABILITIES}
              status={cardStatus(faceOf(card), format)}
              formatLabel={format.label}
              width={tileWidth}
              corner={count ? `×${count}` : undefined}
              // Select art trades the card for another printing; tags are saved by the menu itself.
              onChange={view === 'owned' ? undefined : (next) => faceOf(next).scryfallId !== faceOf(card).scryfallId && trade(view, card, next)}
            />
          ))}
        </div>
      </div>
    </>
  );
}
