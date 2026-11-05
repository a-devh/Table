import { LocalPanel } from '../local/LocalPanel';

export function CollectionModule() {
  return (
    <LocalPanel
      title="Collection"
      views={[
        { view: 'owned', label: 'Owned', empty: 'Right-click a card and choose Add to Collection, or drop table cards here.' },
        { view: 'wishlist', label: 'Wishlist', empty: 'Right-click a card and choose Add to Wishlist.' },
      ]}
    />
  );
}
