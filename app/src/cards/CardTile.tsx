// One card object shown in a side panel (Search now; Favorites and Collection
// later). Every panel uses this same component; the `can` switches say what
// the card can do in that place. Cards in a panel never move around: dragging
// one puts a copy of it on the table.
import type { Card } from '../model/types';
import { faceOf, nameOf } from '../model/card';
import { startCardDrag } from '../board/cardDrag';
import { addToTable, copiesOnTable, removeOneFromTable } from '../board/addToTable';
import { useTable } from '../model/store';
import type { CardStatus } from '../rules/legality';
import { useCardMenu } from '../board/cardMenuStore';
import { priceLabel } from '../rules/prices';
import { useLocalCards } from '../local/localCards';
import { BoxIcon, HeartIcon, StarIcon } from '../app/icons';
import { useCachedImage } from './imageCache';
import { isTouch, watchLongPress } from '../app/device';
import styles from './CardTile.module.css';

export interface CardAbilities {
  /** Drag a copy out onto the table. */
  drag?: boolean;
  /** Shift+click to pick several. */
  pick?: boolean;
  /** The − N + buttons that add or remove copies on the table. */
  step?: boolean;
  /** Name and price under the card (Search). */
  caption?: boolean;
  /** Favorite / Wishlist / Collection buttons on the card's top-left. */
  local?: boolean;
}

const STATUS_LABEL: Record<Exclude<CardStatus, null>, string> = { banned: 'Banned', restricted: 'Restricted', not_legal: 'Not legal' };

interface Props {
  card: Card;
  can: CardAbilities;
  /** Legality in the current format, shown as a badge. */
  status?: CardStatus;
  formatLabel?: string;
  picked?: boolean;
  onPick?: () => void;
  /** The cards a drag takes along (several when this card is picked). Defaults to just this one. */
  dragGroup?: () => Card[];
  onDragOut?: () => void;
  /** Replace this card with the menu's result: a new card object for Select art, the same one with new tags for Set tag. Without it those menu items do nothing here. */
  onChange?: (card: Card) => void;
  /** Width the tile is drawn at, so the browser picks the right image size. */
  width: number;
  /** A count pill on the card's top-right corner, e.g. "×3" owned in Collection. */
  corner?: string;
}

export function CardTile({ card, can, status = null, formatLabel, picked, onPick, dragGroup, onDragOut, onChange, width, corner }: Props) {
  const face = faceOf(card);
  const name = nameOf(card);
  const onTable = useTable((t) => (can.step ? copiesOnTable(t.cards, face.scryfallId) : 0));
  // Scryfall's small image for small tiles: the browser shrinking the big one looks grainy.
  const small = face.imageKey.includes('/normal/') && width * (window.devicePixelRatio || 1) <= 160;
  const image = small ? face.imageKey.replace('/normal/', '/small/') : face.imageKey;
  const src = useCachedImage(image || undefined);
  const price = can.caption ? priceLabel(face) : null;

  return (
    <div
      className={styles.tile}
      data-picked={picked || undefined}
      data-draggable={can.drag || undefined}
      onContextMenu={(e) => {
        e.preventDefault();
        useCardMenu.getState().openPanel(e.clientX, e.clientY, card, onChange);
      }}
      title={`${name} (${face.set.toUpperCase()} ${face.collectorNumber})${status ? ` · ${STATUS_LABEL[status]} in ${formatLabel}` : ''}${can.pick && !isTouch() ? '\nShift+click to select several' : ''}`}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        // Touch: holding a finger on the card opens its menu (there's no right-click).
        const cancelPress = watchLongPress(e, () => {
          stop();
          useCardMenu.getState().openPanel(e.clientX, e.clientY, card, onChange);
        });
        const touch = e.pointerType === 'touch';
        if (!(can.drag || can.pick)) return;
        // A finger can still scroll the panel (touch-action: pan-y), so only a mouse cancels the default.
        if (!touch) e.preventDefault();
        if (e.shiftKey) {
          if (can.pick) onPick?.();
          return;
        }
        if (!can.drag) return;
        const cards = dragGroup?.() ?? [card];
        // Start once the pointer has moved a little, so a plain click stays a click.
        // A finger pulls the card out sideways; up and down scrolls the panel.
        const x0 = e.clientX;
        const y0 = e.clientY;
        const move = (ev: PointerEvent) => {
          const dx = Math.abs(ev.clientX - x0);
          const dy = Math.abs(ev.clientY - y0);
          if (touch ? dx < 12 || dx < dy : Math.hypot(dx, dy) < 4) return;
          stop();
          startCardDrag(cards, ev.clientX, ev.clientY);
          onDragOut?.();
        };
        function stop() {
          cancelPress();
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', stop);
          window.removeEventListener('pointercancel', stop);
        }
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', stop);
        window.addEventListener('pointercancel', stop);
      }}
    >
      <div className={styles.card}>
        {corner && <span className={styles.corner}>{corner}</span>}
        {can.local && <LocalButtons card={card} />}
        {status && (
          <span className={styles.badge} data-status={status}>
            {STATUS_LABEL[status]}
          </span>
        )}
        {image ? (
          src && <img src={src} alt={name} draggable={false} />
        ) : (
          <span className={styles.noImage}>{name}</span>
        )}
        {can.step && (
          <div className={styles.stepper} data-on-table={onTable > 0 || undefined} onPointerDown={(e) => e.stopPropagation()}>
            <button aria-label={`Remove a ${name} from the table`} disabled={onTable === 0} onClick={() => removeOneFromTable(face.scryfallId)}>
              −
            </button>
            <span aria-label={`${onTable} on the table`}>{onTable}</span>
            <button aria-label={`Add a ${name} to the table`} onClick={() => addToTable([card])}>
              +
            </button>
          </div>
        )}
      </div>
      {can.caption && (
        <div className={styles.caption}>
          <span className={styles.name}>{name}</span>
          {price && <span className={styles.price}>{price}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * Favorite, Wishlist and Collection buttons. They show on hover; one that's on
 * stays visible. Collection adds one; − takes one away.
 */
function LocalButtons({ card }: { card: Card }) {
  const face = faceOf(card);
  const entry = useLocalCards((s) => s.cards[face.scryfallId]);
  const owned = entry?.owned ?? 0;
  const local = useLocalCards.getState();
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  return (
    <div className={styles.local} onPointerDown={stop}>
      <button
        aria-pressed={!!entry?.favorited}
        title={entry?.favorited ? 'Remove from Favorites' : 'Add to Favorites'}
        aria-label={entry?.favorited ? 'Remove from Favorites' : 'Add to Favorites'}
        onClick={() => local.setFavorited(face, !entry?.favorited)}
      >
        <StarIcon />
      </button>
      <button
        aria-pressed={!!entry?.wishlisted}
        title={entry?.wishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
        aria-label={entry?.wishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
        onClick={() => local.setWishlisted(face, !entry?.wishlisted)}
      >
        <HeartIcon />
      </button>
      <span className={styles.owned} data-on={owned > 0 || undefined}>
        <button
          aria-pressed={owned > 0}
          title={owned ? `${owned} in your collection. Click to add one more.` : 'Add to Collection'}
          aria-label={owned ? `Add another to Collection (${owned} owned)` : 'Add to Collection'}
          onClick={() => local.addOwned(face, 1)}
        >
          <BoxIcon />
          {owned > 0 && <b>{owned}</b>}
        </button>
        {owned > 0 && (
          <button className={styles.minus} title="Remove one from Collection" aria-label="Remove one from Collection" onClick={() => local.addOwned(face, -1)}>
            −
          </button>
        )}
      </span>
    </div>
  );
}
