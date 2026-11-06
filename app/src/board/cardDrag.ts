// Dragging cards in from a side panel (Search, Favorites, Collection).
// Copies of the panel's card objects are created on the table the moment the drag starts and
// follow the pointer; several cards come out as a stepped column. While part of it is still over the panel, a clipped
// copy of the image covers that part, so it reads as one card sliding onto
// the table. Letting go off the table puts it back (the card is removed).
import { useTable } from '../model/store';
import { CARD_HEIGHT, CARD_RADIUS, CARD_WIDTH } from '../model/derived';
import type { Card } from '../model/types';
import { faceOf, shownImage } from '../model/card';
import { endLiveFit, liveFit, settleFences, startLiveFit } from '../fences/actions';
import { panelDragIds, panelDragPose } from './dragState';
import { STEP } from '../fences/layout';
import { land, landingFor, useLandingPreview } from './snapping';
import { PANEL_DRAG_END } from '../app/device';

function boardRect(): DOMRect | null {
  return document.getElementById('board')?.getBoundingClientRect() ?? null;
}

/** `flipped`: the panel showed the cards turned over, so they land that way (double-faced cards). */
export function startCardDrag(cards: Card[], clientX: number, clientY: number, flipped = false) {
  const board = boardRect();
  if (!board || !cards.length) return;
  const t = useTable.getState();
  const { x: camX, y: camY, zoom } = t.camera;
  const toWorld = (cx: number, cy: number) => ({ x: (cx - board.left - camX) / zoom, y: (cy - board.top - camY) / zoom });
  const start = toWorld(clientX, clientY);
  // Stepped like a fence column, the last card on top under the pointer.
  const n = cards.length;
  const ids = cards.map((c, i) => t.addCard(c, start.x - CARD_WIDTH / 2, start.y - CARD_HEIGHT / 2 - (n - 1 - i) * STEP, flipped));
  // Marked as carried before the table next redraws, so they pop up off the panel.
  for (const id of ids) panelDragIds.add(id);
  t.select(ids);
  const data = faceOf(cards[n - 1]);

  // The part of the card over the panel, drawn above everything.
  // A window onto the panel area only (left of the table), so the card is cut
  // off exactly at the table's edge however it's tilted.
  const cover = document.createElement('div');
  Object.assign(cover.style, {
    position: 'fixed',
    zIndex: '20',
    pointerEvents: 'none',
    left: '0',
    top: '0',
    width: `${Math.max(0, board.left)}px`,
    height: '100vh',
    overflow: 'hidden',
  } satisfies Partial<CSSStyleDeclaration>);
  const image = shownImage(data, flipped);
  const ghost = document.createElement(image ? 'img' : 'div');
  if (ghost instanceof HTMLImageElement) ghost.src = image;
  else ghost.textContent = data.name;
  Object.assign(ghost.style, {
    position: 'absolute',
    width: `${CARD_WIDTH * zoom}px`,
    height: `${CARD_HEIGHT * zoom}px`,
    borderRadius: `${CARD_RADIUS * zoom}px`,
    background: 'var(--line)',
    fontSize: '11px',
    padding: image ? '0' : '6px',
    boxSizing: 'border-box',
    transformOrigin: '50% 50%',
    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.35)',
  } satisfies Partial<CSSStyleDeclaration>);
  if (n > 1) {
    // How many cards are coming along.
    ghost.title = `${n} cards`;
    ghost.style.outline = '3px solid var(--accent)';
  }
  cover.appendChild(ghost);
  document.body.appendChild(cover);
  document.body.style.cursor = 'grabbing';
  // Phone: the panel sheet steps aside while the card is out (Modules.module.css).
  document.body.dataset.cardDrag = '';

  let lastX = clientX;
  let lastY = clientY;
  const place = (cx: number, cy: number) => {
    const z = useTable.getState().camera.zoom;
    const left = cx - (CARD_WIDTH * z) / 2;
    const top = cy - (CARD_HEIGHT * z) / 2;
    ghost.style.left = `${left}px`;
    ghost.style.top = `${top}px`;
  };
  place(clientX, clientY);
  Object.assign(panelDragPose, { scale: 1, rise: 0, tilt: 0 });
  // Match the table card's pop, lift and sway every frame (TableScene sets the pose).
  let frame = 0;
  const pose = () => {
    const z = useTable.getState().camera.zoom;
    ghost.style.transform = `translateY(${-panelDragPose.rise * z}px) rotate(${panelDragPose.tilt}rad) scale(${panelDragPose.scale})`;
    frame = requestAnimationFrame(pose);
  };
  pose();
  startLiveFit(ids);

  const move = (e: PointerEvent) => {
    const s = useTable.getState();
    s.moveCards(ids, (e.clientX - lastX) / s.camera.zoom, (e.clientY - lastY) / s.camera.zoom);
    lastX = e.clientX;
    lastY = e.clientY;
    place(e.clientX, e.clientY);
    liveFit();
    const r = boardRect();
    const onBoard = !!r && e.clientX >= r.left && e.clientX <= r.right;
    useLandingPreview.getState().set(onBoard ? landingFor(ids, ids[ids.length - 1], e.altKey) : null);
  };
  const finish = (keep: boolean, noGrid = false) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('keydown', key);
    window.removeEventListener('pointercancel', cancel);
    cancelAnimationFrame(frame);
    cover.remove();
    document.body.style.cursor = '';
    delete document.body.dataset.cardDrag;
    window.dispatchEvent(new Event(PANEL_DRAG_END));
    endLiveFit();
    panelDragIds.clear();
    useLandingPreview.getState().set(null);
    if (keep) {
      land(ids, ids[ids.length - 1], noGrid);
      settleFences();
    } else useTable.getState().removeCards(ids);
  };
  const up = (e: PointerEvent) => {
    const r = boardRect();
    finish(!!r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom, e.altKey);
  };
  const key = (e: KeyboardEvent) => e.key === 'Escape' && finish(false);
  // The browser took the touch over (e.g. a scroll): put it back.
  const cancel = () => finish(false);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('pointerup', up);
  window.addEventListener('keydown', key);
}
