// Which list the side panel shows (Favorites, Owned or Wishlist), so a card
// dropped from the table goes into the list you're looking at.
export type LocalView = 'favorites' | 'owned' | 'wishlist';

let openView: LocalView = 'favorites';
export const openLocalView = () => openView;

/** Called by the panel when its tab changes; also labels the drop hint. */
export function setOpenLocalView(view: LocalView) {
  openView = view;
  const panel = document.querySelector<HTMLElement>('[data-remove-drop]');
  if (panel) panel.dataset.list = view;
}
