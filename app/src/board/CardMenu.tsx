// Right-click menu for a card, on the table or in a side panel. One menu for
// both, since it's the same card object; items that don't apply where the
// card is are left out.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTable } from '../model/store';
import type { Card, TableCard } from '../model/types';
import { canFlip, faceOf, nameOf, printingOf, swapCard } from '../model/card';
import { STEP } from '../fences/layout';
import { settleFences } from '../fences/actions';
import { addCopyOf, addToTable, copiesOnTable, removeOneFromTable } from './addToTable';
import { useCardMenu, type MenuTarget } from './cardMenuStore';
import { ArtPicker } from '../cards/ArtPicker';
import { useArtPicker } from '../cards/artPickerStore';
import { allPrices, scryfallUrl } from '../rules/prices';
import { openLink } from '../app/openLink';
import { useLocalCards } from '../local/localCards';
import { setDeckCover } from '../decks/library';
import styles from './CardMenu.module.css';

type ItemFn = (label: string, onClick: () => void, opts?: { disabled?: boolean; hint?: string; keepOpen?: boolean }) => React.ReactNode;

/** Favorites, Wishlist and Collection: remembered in the app for this printing. */
function LocalItems({ cards, item }: { cards: Card[]; item: ItemFn }) {
  const local = useLocalCards();
  const faces = cards.map(faceOf);
  const allFav = faces.every((d) => local.cards[d.scryfallId]?.favorited);
  const allWish = faces.every((d) => local.cards[d.scryfallId]?.wishlisted);
  const owned = faces.reduce((sum, d) => sum + (local.cards[d.scryfallId]?.owned ?? 0), 0);
  return (
    <>
      {item(allFav ? 'Remove from Favorites' : 'Add to Favorites', () => faces.forEach((d) => local.setFavorited(d, !allFav)), { hint: allFav ? '★' : '☆' })}
      {item(allWish ? 'Remove from Wishlist' : 'Add to Wishlist', () => faces.forEach((d) => local.setWishlisted(d, !allWish)))}
      {item(cards.length > 1 ? 'Add 1 of each to Collection' : 'Add to Collection', () => faces.forEach((d) => local.addOwned(d, 1)), {
        hint: owned ? `${owned} owned` : undefined,
      })}
      {owned > 0 && item(cards.length > 1 ? 'Remove 1 of each from Collection' : 'Remove 1 from Collection', () => faces.forEach((d) => local.addOwned(d, -1)))}
    </>
  );
}

export function CardMenu() {
  const menu = useCardMenu((s) => s.menu);
  const close = useCardMenu((s) => s.close);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onDown = (e: PointerEvent) => !(e.target as HTMLElement).closest('[role=menu]') && close();
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [menu, close]);

  return (
    <>
      {menu &&
        createPortal(
          // Keep the menu on screen near the window's right and bottom edges.
          <div
            role="menu"
            aria-label="Card options"
            className={styles.menu}
            style={{
              left: Math.max(8, Math.min(menu.x, window.innerWidth - 230)),
              top: Math.max(8, Math.min(menu.y, window.innerHeight - 460)),
              maxHeight: `calc(100dvh - ${Math.max(8, Math.min(menu.y, window.innerHeight - 460))}px - 8px)`,
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <MenuItems target={menu.target} close={close} />
          </div>,
          document.body,
        )}
      <ArtPicker />
    </>
  );
}

function MenuItems({ target, close }: { target: MenuTarget; close: () => void }) {
  const tableCards = useTable((s) => s.cards);
  const [tagsOpen, setTagsOpen] = useState(false);

  // The cards this menu acts on, and how to change one of them.
  const onTable = target.kind === 'table';
  const cards: Card[] = onTable ? (target.cardIds.map((id) => tableCards[id]).filter(Boolean) as TableCard[]) : [target.card];
  if (!cards.length) return null;
  const first = cards[0];
  const name = nameOf(first);
  const n = cards.length;
  const panelCopies = onTable ? 0 : copiesOnTable(tableCards, printingOf(first));

  const item = (label: string, onClick: () => void, opts: { disabled?: boolean; hint?: string; keepOpen?: boolean } = {}) => (
    <button
      role="menuitem"
      className={styles.item}
      disabled={opts.disabled}
      onClick={() => {
        onClick();
        if (!opts.keepOpen) close();
      }}
    >
      <span>{label}</span>
      {opts.hint && <kbd>{opts.hint}</kbd>}
    </button>
  );

  const t = useTable.getState();
  // Only copies of the same printing merge: a merged card shows one printing.
  const sameName = n > 1 && cards.every((c) => printingOf(c) === printingOf(first));
  const merged = n === 1 && first.copies.length > 1;

  // Prices for one card; a selection shows its total (each copy counted).
  const prices = n === 1 ? allPrices(faceOf(first)) : [];
  const total = cards.reduce((sum, c) => sum + c.copies.reduce((s, copy) => s + Number(copy.data.prices.usd ?? copy.data.prices.usdFoil ?? 0), 0), 0);

  return (
    <>
      {n === 1 ? (
        <div className={styles.prices}>
          {prices.length ? (
            prices.map((p) => (
              <span key={p.label}>
                <small>{p.label}</small> {p.value}
              </span>
            ))
          ) : (
            <span>
              <small>No price on Scryfall</small>
            </span>
          )}
        </div>
      ) : (
        <div className={styles.prices}>
          <span>
            <small>{n} cards</small> ${total.toFixed(2)}
          </span>
        </div>
      )}
      {n === 1 && item('Open on Scryfall', () => void openLink(scryfallUrl(faceOf(first))), { hint: '↗' })}
      <div className={styles.divider} />
      {onTable
        ? item(n > 1 ? `Add 1 of each` : 'Add 1', () => (cards as TableCard[]).forEach(addCopyOf))
        : item('Add 1 to table', () => addToTable([first]))}
      {onTable
        ? item(n > 1 ? 'Remove 1 of each' : 'Remove 1', () => cards.forEach((c) => t.removeCopy(c.id)))
        : item('Remove 1 from table', () => removeOneFromTable(printingOf(first)), { disabled: panelCopies === 0, hint: panelCopies ? `${panelCopies} on table` : undefined })}

      {onTable && (sameName || merged) && <div className={styles.divider} />}
      {onTable && sameName && item(`Merge ${n} into one`, () => (t.mergeCards(cards.map((c) => c.id)), settleFences()))}
      {onTable && merged && item(`Split into ${first.copies.length}`, () => (t.splitCard(first.id, STEP), settleFences()))}

      <div className={styles.divider} />
      {onTable && n === 1 && item('Use as deck cover', () => setDeckCover(faceOf(first)))}
      {onTable && cards.some(canFlip) && item('Turn over', () => t.flipCards(cards.map((c) => c.id)), { hint: 'F' })}
      {n === 1 &&
        item('Select art…', () =>
          useArtPicker.getState().open(name, faceOf(first).scryfallId, (data) => {
            // Trades the card for a new card object of that printing; the old card object is untouched.
            if (onTable) t.swapPrinting(first.id, data);
            else target.onChange?.(swapCard(first, data));
          }),
        )}
      {item('Set tag', () => setTagsOpen((o) => !o), { keepOpen: true, hint: tagsOpen ? '▾' : '▸' })}
      {tagsOpen && <TagChoices cards={cards} target={target} />}

      <div className={styles.divider} />
      <LocalItems cards={cards} item={item} />

      {onTable && (
        <>
          <div className={styles.divider} />
          {item(n > 1 ? `Delete ${n} cards` : 'Delete', () => t.removeCards(cards.map((c) => c.id)), { hint: 'Del' })}
        </>
      )}
    </>
  );
}

/** Tag checkboxes inside the menu, plus a box to make a new tag. */
function TagChoices({ cards, target }: { cards: Card[]; target: MenuTarget }) {
  const tags = useTable((s) => s.tags);
  const [draft, setDraft] = useState('');
  // A panel card isn't in the store, so keep its tags here as they change.
  const [panelTags, setPanelTags] = useState(() =>
    target.kind === 'panel' ? [...new Set([...target.card.tagIds, ...(useLocalCards.getState().cards[faceOf(target.card).scryfallId]?.tagIds ?? [])])] : [],
  );
  const tagIdsOf = (c: Card) => (target.kind === 'panel' ? panelTags : c.tagIds);

  const setTag = (tagId: string, on: boolean) => {
    if (target.kind === 'panel') {
      const next = on ? [...new Set([...panelTags, tagId])] : panelTags.filter((id) => id !== tagId);
      setPanelTags(next);
      target.onChange?.({ ...target.card, tagIds: next });
      useLocalCards.getState().setTags(faceOf(target.card), next);
      return;
    }
    const t = useTable.getState();
    for (const c of cards) (on ? t.tagCard : t.untagCard)(c.id, tagId);
    settleFences();
  };

  /** Take every tag off these cards. */
  const clearTags = () => {
    if (target.kind === 'panel') {
      setPanelTags([]);
      target.onChange?.({ ...target.card, tagIds: [] });
      useLocalCards.getState().setTags(faceOf(target.card), []);
      return;
    }
    const t = useTable.getState();
    for (const c of cards) for (const id of c.tagIds) t.untagCard(c.id, id);
    settleFences();
  };
  const anyTagged = cards.some((c) => tagIdsOf(c).length > 0);

  return (
    <div className={styles.tags}>
      {Object.values(tags).map((tag) => {
        const all = cards.every((c) => tagIdsOf(c).includes(tag.id));
        return (
          <label key={tag.id} className={styles.tag}>
            <input type="checkbox" checked={all} onChange={(e) => setTag(tag.id, e.target.checked)} />
            <span>{tag.name}</span>
          </label>
        );
      })}
      {anyTagged && (
        <button type="button" className={styles.clearTags} onClick={clearTags}>
          Clear tags
        </button>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const name = draft.trim();
          if (!name) return;
          const existing = Object.values(useTable.getState().tags).find((t) => t.name.toLowerCase() === name.toLowerCase());
          setTag(existing?.id ?? useTable.getState().createTag(name), true);
          setDraft('');
        }}
      >
        <input aria-label="New tag" className={styles.tagInput} placeholder="New tag…" value={draft} onChange={(e) => setDraft(e.target.value)} />
      </form>
    </div>
  );
}
