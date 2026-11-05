import { LocalPanel } from '../local/LocalPanel';
import { menuGesture } from '../app/device';

export function FavoritesModule() {
  return (
    <LocalPanel
      title="Favorites"
      views={[{ view: 'favorites', label: 'Favorites', empty: `${menuGesture()} a card and choose Add to Favorites, or drop table cards here.` }]}
    />
  );
}
