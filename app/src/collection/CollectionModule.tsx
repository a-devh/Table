import { LocalPanel } from '../local/LocalPanel';
import { menuGesture } from '../app/device';

export function CollectionModule() {
  return (
    <LocalPanel
      title="Collection"
      views={[
        { view: 'owned', label: 'Owned', empty: `${menuGesture()} a card and choose Add to Collection, or drop table cards here.` },
        { view: 'wishlist', label: 'Wishlist', empty: `${menuGesture()} a card and choose Add to Wishlist.` },
      ]}
    />
  );
}
