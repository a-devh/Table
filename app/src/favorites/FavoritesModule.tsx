import { LocalPanel } from '../local/LocalPanel';

export function FavoritesModule() {
  return (
    <LocalPanel
      title="Favorites"
      views={[{ view: 'favorites', label: 'Favorites', empty: 'Right-click a card and choose Add to Favorites, or drop table cards here.' }]}
    />
  );
}
