// Keeps the Pixi scene in sync with the table state and turns pointer input
// into table actions. Rendering reads state; input only calls actions.
//
// Controls (docs/requirements.md): left-drag on a card moves it, left-drag on
// empty table pans, wheel zooms. Shift + click adds/removes a card from the
// selection; Shift + drag selects by area. Pencil + drag draws a fence (holding
// Ctrl turns on the Pencil). Right-click opens the card menu; dropping cards on
// the side panel removes them.
//
// Touch: one finger works like the left button (drag a card, pan the table),
// two fingers pinch to zoom and pan from anywhere, a long-press on a card
// opens its menu, and the Select tool stands in for Shift.
import { setDeckCover } from '../decks/library';
import { cachedImage } from '../cards/imageCache';
import { Application, Assets, CanvasSource, Container, FederatedPointerEvent, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { useTable } from '../model/store';
import { CARD_HEIGHT, CARD_RADIUS, CARD_SCALE, CARD_WIDTH, GRID_CELL, cardAt, cardsInFence, groupShown } from '../model/derived';

// The placeholder face and the card back are drawn at a 96x134 base size and
// scaled up by CARD_SCALE, so their proportions stay in one place.
const BASE_W = 96;
const BASE_H = 134;
/** Most tag pills drawn on one card. */
const MAX_TAGS = 5;
import type { Fence, TableCard, TableState } from '../model/types';
import { pileTop, shownImage } from '../model/card';
import { watchLongPress } from '../app/device';
import { useFenceUi } from '../fences/uiStore';
import { endLiveFit, liveFit, settleFences, startLiveFit } from '../fences/actions';
import { useCardMenu } from './cardMenuStore';
import { useLocalCards } from '../local/localCards';
import { panelDragIds, panelDragPose } from './dragState';
import { usePeek } from './peekStore';
import { openLocalView } from '../local/openView';
import { useDeckCheck } from '../formats/deckCheckStore';
import { gridStep, land, landingFor, snapToGrid, useLandingPreview } from './snapping';
import { tableColors, THEME_EVENT } from '../settings/theme';
import { useSettings } from '../settings/settingsStore';
import { priceLabel } from '../rules/prices';

/** Theme colors (Settings > Appearance), refreshed when the theme changes. */
let colors = tableColors();
import type { Issue } from '../rules/deckCheck';
import { COLUMN_WIDTH, FIRST_CARD, groupCards } from '../fences/layout';

/** Smallest fence worth keeping; smaller drags are treated as a slip. */
const MIN_FENCE = 40;

const COLOR: Record<string, { frame: number; strip: number; art: number }> = {
  W: { frame: 0xd8cfae, strip: 0xf4efdf, art: 0xcfc5a2 },
  U: { frame: 0x3b6fb6, strip: 0xdbe4f1, art: 0x7f9fcc },
  B: { frame: 0x4a4248, strip: 0xdcd6d9, art: 0x7d737a },
  R: { frame: 0xc8513a, strip: 0xf2dcd6, art: 0xd48a7a },
  G: { frame: 0x3e7d4f, strip: 0xdfe8d6, art: 0x7fa685 },
  multi: { frame: 0xb8963c, strip: 0xefe5c8, art: 0xa7b68a },
  none: { frame: 0x8a7f6e, strip: 0xe6e0d5, art: 0xa99f8c },
};

function cardColors(card: TableCard) {
  const colors = card.copies[0].data.colors;
  if (colors.length > 1) return COLOR.multi;
  return COLOR[colors[0]] ?? COLOR.none;
}

type Drag =
  | { kind: 'pan'; lastX: number; lastY: number }
  | {
      kind: 'cards';
      ids: string[];
      lead: string;
      lastX: number;
      lastY: number;
      start: Record<string, { x: number; y: number }>;
      /** False until the pointer has moved past DRAG_THRESHOLD: a click never changes a card's layer. */
      started: boolean;
      downX: number;
      downY: number;
    }
  | { kind: 'draw'; startX: number; startY: number; x: number; y: number }
  | { kind: 'box'; startX: number; startY: number; x: number; y: number; cardId?: string; base: string[] };

// Pixi's clientX/Y are relative to the canvas; DOM checks need window coordinates.
const viewportX = (e: FederatedPointerEvent) => (e.nativeEvent as PointerEvent).clientX;
const viewportY = (e: FederatedPointerEvent) => (e.nativeEvent as PointerEvent).clientY;

/** True when a screen point is over the open side panel (a drop there removes cards, or adds them to Favorites / Collection). */
function overRemoveTarget(clientX: number, clientY: number): boolean {
  const r = document.querySelector('[data-remove-drop]')?.getBoundingClientRect();
  return !!r && clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
}

/** Which side panel is open: 'search', 'favorites', 'collection' or 'decks'. */
const openPanel = () => document.querySelector<HTMLElement>('[data-remove-drop]')?.dataset.removeDrop ?? 'search';

/**
 * The standard Magic card back (Scryfall's image of it), cached like card images
 * and in the same size as the card faces.
 */
const CARD_BACK_URL = 'https://backs.scryfall.io/normal/0/a/0aeebaf5-8c7d-4636-9e82-8c27447861f7.jpg';

/** The face-down side shown for cards in a stacked fence: the real card back, with a drawn stand-in until it loads (or offline). */
function cardBack(): Container {
  const back = new Container();
  const drawn = new Graphics()
    .roundRect(0, 0, BASE_W, BASE_H, 6)
    .fill(0x3a2a1c)
    .roundRect(5, 5, BASE_W - 10, BASE_H - 10, 4)
    .fill(0x6b4a2b)
    .ellipse(BASE_W / 2, BASE_H / 2, 30, 42)
    .fill(0x2b4a7a)
    .ellipse(BASE_W / 2, BASE_H / 2, 30, 42)
    .stroke({ width: 2, color: 0xc89b5a });
  drawn.scale.set(CARD_WIDTH / BASE_W, CARD_HEIGHT / BASE_H);
  back.addChild(drawn);
  cardTexture(CARD_BACK_URL)
    .then((texture) => {
      if (back.destroyed) return;
      const sprite = new Sprite(texture);
      sprite.width = CARD_WIDTH;
      sprite.height = CARD_HEIGHT;
      back.addChild(sprite);
      drawn.visible = false;
    })
    .catch(() => undefined);
  return back;
}

/**
 * A merged card sits on a small pile: up to three card edges peeking out
 * below it, each nudged and turned a little like a real stack.
 */
function pile(copies: number): Container {
  const layers = new Container();
  layers.label = 'pile';
  const n = Math.min(copies - 1, 3);
  for (let i = n; i >= 1; i--) {
    const edge = new Graphics()
      .roundRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS)
      .fill(0x151515)
      .stroke({ width: 2, color: 0x3c3c3c });
    edge.position.set(CARD_WIDTH / 2 + i * 4, CARD_HEIGHT / 2 + i * 5);
    edge.rotation = (i % 2 ? 1 : -1) * 0.012 * i;
    layers.addChild(edge);
  }
  return layers;
}

/**
 * Card image as a texture with rounded corners baked in and a full mipmap
 * chain, shared by every copy of the same image.
 * - Corners are cut on a 2D canvas, which antialiases them. (A Graphics mask
 *   uses the stencil buffer, so its edges come out jagged.)
 * - Mipmaps (trilinear filtering) keep the image smooth instead of grainy and
 *   shimmering when it's drawn much smaller than its 488x680 pixels.
 */
const textures = new Map<string, Promise<Texture>>();
function cardTexture(url: string): Promise<Texture> {
  let request = textures.get(url);
  if (!request) {
    request = cachedImage(url).then(async ({ src, release }) => {
      const loaded = await Assets.load<Texture>({ src, parser: 'texture' }).finally(release);
      const image = loaded.source.resource as CanvasImageSource;
      const w = loaded.source.pixelWidth;
      const h = loaded.source.pixelHeight;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, (CARD_RADIUS / CARD_WIDTH) * w);
      ctx.clip();
      ctx.drawImage(image, 0, 0, w, h);
      // The canvas holds its own copy now.
      Assets.unload(src).catch(() => undefined);
      const source = new CanvasSource({ resource: canvas, autoGenerateMipmaps: true, scaleMode: 'linear' });
      return new Texture({ source });
    });
    request.catch(() => textures.delete(url));
    textures.set(url, request);
  }
  return request;
}

/** A card gliding to a new spot (a sorted view re-laying out, a snap, a throw). */
interface Tween {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  start: number;
  duration: number;
}

/** Default glide time when cards move without being dragged. */
const GLIDE_MS = 220;
/** A thrown card slows down at this rate (table px per ms²). */
const THROW_FRICTION = 0.004;
/** Release speed (table px per ms) above which a dragged card slides on. */
const THROW_MIN_SPEED = 0.7;
/** A finger needs a firmer flick to throw, so a quick drag doesn't send cards sliding. */
const TOUCH_THROW_MIN_SPEED = 1.6;
const THROW_MAX_DISTANCE = 1400;
/** How much a picked-up card grows, and how far it rises (table px). */
const LIFT_SCALE = 0.04;
const LIFT_RISE = 10;
/** Below zero, lift is a card pressing into the table as it lands: it shrinks this much per unit. */
const PRESS_SCALE = 0.12;
/** A card pulled out of a side panel starts this "low" (smaller), so it pops up off the panel. */
const PANEL_POP = -2;
/** Sway while moving: radians of tilt per screen px/ms of sideways speed, and the most it tilts. */
const TILT_PER_SPEED = 0.08;
const TILT_MAX = 0.14;
const easeOut = (t: number) => 1 - (1 - t) ** 3;
/** Size of a card at a given lift: grown when raised, pressed smaller while landing or popping out of a panel. */
const liftScale = (l: number) => (l >= 0 ? 1 + LIFT_SCALE * l : 1 + PRESS_SCALE * Math.max(-1, l) - (l < -1 ? 0.06 * (-1 - l) : 0));
/** Users who ask the OS for less motion get no sway and no bounce. */
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * A damped spring, stepped per frame. `freq` is the natural frequency (rad per
 * ms) and `damping` the damping ratio: under 1 overshoots and settles, which
 * gives pickups a little pop and drops a little press into the table.
 */
interface Spring {
  value: number;
  velocity: number;
  target: number;
}
function stepSpring(s: Spring, dt: number, freq: number, damping: number) {
  // Small sub-steps keep it stable when a frame runs long.
  for (let left = dt; left > 0; left -= 8) {
    const h = Math.min(8, left);
    const accel = freq * freq * (s.target - s.value) - 2 * damping * freq * s.velocity;
    s.velocity += accel * h;
    s.value += s.velocity * h;
  }
}
const settled = (s: Spring) => Math.abs(s.target - s.value) < 0.002 && Math.abs(s.velocity) < 0.0002;
/** Lift: quick, with a visible overshoot. Tilt: a softer sway. */
const LIFT_FREQ = (2 * Math.PI) / 260;
const LIFT_DAMPING = 0.45;
const TILT_FREQ = (2 * Math.PI) / 340;
const TILT_DAMPING = 0.5;
/** Hover: a card under the pointer for this long (just enough to skip cards the pointer passes over) magnifies and comes to the front. */
const HOVER_DELAY = 60;
/** A hovered card grows this much: a gentle nudge, not a zoom. */
const HOVER_SCALE = 1.08;
/** A card in a pile slides this far (table px) out of it while hovered, back against the way the pile runs. */
const PILE_SLIDE = 2 * GRID_CELL;
/** Hover eases in and out quickly with no overshoot. */
const HOVER_FREQ = (2 * Math.PI) / 140;
const HOVER_DAMPING = 1;
/** A press only becomes a drag (and lifts the card out of its layer) after this many screen px. */
const DRAG_THRESHOLD = 4;
/** Turning a double-faced card over: the new side opens out from edge-on over this long. */
const FLIP_MS = 200;

export class TableScene {
  private world = new Container();
  private fenceLayer = new Container();
  private cardLayer = new Container();
  private cardViews = new Map<string, Container>();
  private cardTagKeys = new Map<string, string>();
  private cardIssueKeys = new Map<string, string>();
  /** Printing and copy count each card view was drawn with; a change rebuilds the view. */
  private cardFaceKeys = new Map<string, string>();
  private fenceViews = new Map<string, Container>();
  private fenceKeys = new Map<string, string>();
  private drawPreview = new Graphics();
  private landingPreview = new Graphics();
  private cardOrder = '';
  private drag: Drag | null = null;
  private unsubscribe: () => void;
  private unsubscribeCheck: () => void;
  private unsubscribePreview: () => void;
  private unsubscribeSettings: () => void;
  private host: HTMLElement;
  private app: Application;
  // Motion: where each card is drawn (base, before lift), where it's heading, and how lifted it is.
  private base = new Map<string, { x: number; y: number }>();
  /** Hover magnify per card (0..1), and where a pile card slides out to (table px). */
  private hover = new Map<string, Spring & { slide: { x: number; y: number }; anchor: { x: number; y: number } }>();
  private hoverId: string | null = null;
  private lastPointer = { x: 0, y: 0 };
  private hoverTimer: ReturnType<typeof setTimeout> | undefined;
  private targets = new Map<string, { x: number; y: number }>();
  private tweens = new Map<string, Tween>();
  private lift = new Map<string, Spring>();
  /** Sway of a moving card (radians), and its smoothed sideways speed (screen px per ms). */
  private tilt = new Map<string, Spring & { speed: number; lastX: number }>();
  /** The card's own rotation from the store; tilt is drawn on top of it. */
  private rotations = new Map<string, number>();
  /** Cards turning over (double-faced): when the turn started. */
  private flips = new Map<string, number>();
  /** Which side each card was last drawn with, to notice a flip. */
  private flippedSides = new Map<string, boolean>();
  /** Glide time for the next store update (a throw sets a longer one). */
  private glideMs: number | null = null;
  /** Recent pointer positions while dragging cards, to measure a throw. */
  private dragSamples: { t: number; x: number; y: number }[] = [];
  /** The pointer that started the current drag; other fingers don't move it. */
  private dragPointer: number | null = null;
  /** Fingers on the table (window coordinates), for pinch. */
  private touches = new Map<number, { x: number; y: number }>();
  /** Two-finger pinch in progress: last center and finger distance. */
  private pinch: { cx: number; cy: number; dist: number } | null = null;
  private cancelLongPress = () => {};

  constructor(app: Application, host: HTMLElement) {
    this.host = host;
    this.app = app;
    app.ticker.add(this.tick);
    // Read now: the theme is applied after this module first loads.
    colors = tableColors();
    this.world.addChild(this.fenceLayer, this.landingPreview, this.cardLayer, this.drawPreview);
    app.stage.addChild(this.world);

    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.on('pointerdown', this.onBackgroundDown);
    app.stage.on('globalpointermove', this.onPointerMove);
    app.stage.on('pointerup', this.onPointerUp);
    app.stage.on('pointerupoutside', this.onPointerUp);
    host.addEventListener('wheel', this.onWheel, { passive: false });
    host.addEventListener('contextmenu', this.onContextMenu);
    host.addEventListener('pointerleave', this.onLeave);
    // Capture phase: fingers are counted before Pixi sees the event, so a second finger can turn a drag into a pinch.
    host.addEventListener('pointerdown', this.onTouchDown, true);
    window.addEventListener('pointermove', this.onTouchMove, true);
    window.addEventListener('pointerup', this.onTouchUp, true);
    window.addEventListener('pointercancel', this.onTouchUp, true);
    host.style.touchAction = 'none';
    window.addEventListener(THEME_EVENT, this.onTheme);

    this.sync(useTable.getState());
    this.unsubscribe = useTable.subscribe((s, prev) => {
      // A pan or zoom only moves the camera: skip the per-card and per-fence work.
      const onlyCamera =
        s.cards === prev.cards && s.fences === prev.fences && s.tags === prev.tags && s.selection === prev.selection && s.activeTool === prev.activeTool;
      if (onlyCamera) this.syncCamera(s);
      else this.sync(s);
    });
    this.unsubscribeCheck = useDeckCheck.subscribe(() => this.sync(useTable.getState()));
    this.unsubscribePreview = useLandingPreview.subscribe((s) => this.drawLanding(s.landing));
    this.unsubscribeSettings = useSettings.subscribe((s, prev) => s.tablePrices !== prev.tablePrices && this.sync(useTable.getState()));
  }

  destroy() {
    this.app.ticker.remove(this.tick);
    this.unsubscribe();
    this.unsubscribeCheck();
    this.unsubscribePreview();
    this.unsubscribeSettings();
    this.host.removeEventListener('wheel', this.onWheel);
    this.host.removeEventListener('contextmenu', this.onContextMenu);
    this.host.removeEventListener('pointerleave', this.onLeave);
    this.host.removeEventListener('pointerdown', this.onTouchDown, true);
    window.removeEventListener('pointermove', this.onTouchMove, true);
    window.removeEventListener('pointerup', this.onTouchUp, true);
    window.removeEventListener('pointercancel', this.onTouchUp, true);
    this.cancelLongPress();
    window.removeEventListener(THEME_EVENT, this.onTheme);
  }

  /** Theme changed: rebuild everything drawn in theme colors (card images stay cached). */
  private onTheme = () => {
    colors = tableColors();
    this.fenceKeys.clear();
    for (const view of this.cardViews.values()) view.destroy({ children: true });
    this.cardViews.clear();
    this.cardTagKeys.clear();
    this.cardIssueKeys.clear();
    this.cardFaceKeys.clear();
    this.cardOrder = '';
    this.sync(useTable.getState());
  };

  // ---- rendering -------------------------------------------------------

  private syncCamera(state: TableState) {
    const { x, y, zoom } = state.camera;
    this.world.position.set(x, y);
    this.world.scale.set(zoom);
    this.syncGrid(x, y, zoom);
  }

  private sync(state: TableState) {
    this.syncCamera(state);
    this.host.style.cursor = state.activeTool === 'pencil' ? 'crosshair' : '';
    this.syncFences(state);
    this.syncCards(state);
  }

  /** The dotted background is the snap grid: it pans and zooms with the table. */
  private syncGrid(x: number, y: number, zoom: number) {
    // A dot on every snap point; thinned out when zoomed far out (snapping thins out with them, see gridStep).
    const spacing = gridStep(zoom) * zoom;
    const style = this.host.style;
    style.backgroundSize = `${spacing}px ${spacing}px`;
    // The gradient draws its dot in the middle of each tile; shift so dots sit on grid points.
    style.backgroundPosition = `${x - spacing / 2}px ${y - spacing / 2}px`;
  }

  /** Outline where the dragged cards will land. */
  private drawLanding(landing: ReturnType<typeof landingFor>) {
    const g = this.landingPreview.clear();
    if (!landing) return;
    const stack = landing.kind === 'stack';
    const zoom = useTable.getState().camera.zoom;
    for (const p of Object.values(landing.positions).slice(0, 40)) {
      g.roundRect(p.x, p.y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS)
        // Bold enough to read at a glance from a distance; a stack spot is bolder still (it wins over the grid).
        .fill({ color: colors.accent, alpha: stack ? 0.3 : 0.2 })
        .stroke({ width: (stack ? 4 : 3) / zoom, color: colors.accent, alpha: 1 });
    }
  }

  private syncFences(state: TableState) {
    for (const [id, view] of this.fenceViews) {
      if (!state.fences[id]) {
        view.destroy({ children: true });
        this.fenceViews.delete(id);
        this.fenceKeys.delete(id);
      }
    }
    for (const fence of Object.values(state.fences)) {
      let view = this.fenceViews.get(fence.id);
      if (!view) {
        view = new Container();
        this.fenceViews.set(fence.id, view);
        this.fenceLayer.addChild(view);
      }
      view.position.set(fence.x, fence.y);
      // A group shows only while its fence is open in the Custom view.
      view.visible = !fence.parentId || groupShown(fence, state.fences);
      if (!view.visible) continue;
      // Redraw only when something visible changed (not on every camera move).
      const labels = fence.view === 'custom' || fence.stacked ? [] : groupCards(cardsInFence(state, fence.id), fence.view, state.tags).map((g) => `${g.label} (${g.count})`);
      const key = [fence.width, fence.height, ...labels].join('|');
      if (this.fenceKeys.get(fence.id) !== key) {
        this.fenceKeys.set(fence.id, key);
        this.drawFence(view, fence, labels);
      }
    }
  }

  private drawFence(view: Container, fence: Fence, groupLabels: string[]) {
    view.removeChildren().forEach((c) => c.destroy());
    // A group is drawn quieter than its fence: a fainter line and a light tint.
    const group = !!fence.parentId;
    const frame = new Graphics()
      .roundRect(0, 0, fence.width, fence.height, group ? 10 : 12)
      .fill({ color: group ? colors.accent : 0xffffff, alpha: group ? 0.04 : 0.03 })
      .stroke({ width: group ? 1.5 : 1.5, color: group ? colors.accent : colors.fenceLine, alpha: group ? 0.55 : 1 });
    view.addChild(frame);
    // Sorted views label each column (the name itself is in the React overlay).
    groupLabels.forEach((text, i) => {
      const label = new Text({
        text,
        style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14, fontWeight: '600', fill: colors.fenceLabel },
      });
      label.position.set(FIRST_CARD.x + i * COLUMN_WIDTH, 14);
      view.addChild(label);
    });
  }

  private syncCards(state: TableState) {
    const faceDown = new Set<string>();
    for (const f of Object.values(state.fences)) {
      if (f.stacked) for (const c of cardsInFence(state, f.id)) faceDown.add(c.id);
    }
    const pencil = state.activeTool === 'pencil';
    for (const [id, view] of this.cardViews) {
      if (!state.cards[id]) {
        view.destroy({ children: true });
        this.cardViews.delete(id);
        this.base.delete(id);
        this.targets.delete(id);
        this.tweens.delete(id);
        this.lift.delete(id);
        this.tilt.delete(id);
        this.rotations.delete(id);
        this.flips.delete(id);
        this.flippedSides.delete(id);
        this.cardTagKeys.delete(id);
        this.cardIssueKeys.delete(id);
        this.cardFaceKeys.delete(id);
      }
    }
    const issues = useDeckCheck.getState().cardIssues;
    for (const card of Object.values(state.cards)) {
      let view = this.cardViews.get(card.id);
      // A new printing (Select art), a merge/split or turning it over redraws the card.
      const flipped = !!card.flipped;
      const faceKey = `${pileTop(card)?.scryfallId ?? 'back'}|${flipped}|${card.copies.length}|${useSettings.getState().tablePrices}`;
      // Turned over: the other side opens out from edge-on.
      if (this.flippedSides.has(card.id) && this.flippedSides.get(card.id) !== flipped && !reducedMotion()) this.flips.set(card.id, performance.now());
      this.flippedSides.set(card.id, flipped);
      if (view && this.cardFaceKeys.get(card.id) !== faceKey) {
        view.destroy({ children: true });
        view = undefined;
        this.cardTagKeys.delete(card.id);
        this.cardIssueKeys.delete(card.id);
        this.cardOrder = '';
      }
      const fresh = !view;
      if (!view) {
        view = this.createCardView(card);
        this.cardViews.set(card.id, view);
        this.cardFaceKeys.set(card.id, faceKey);
        this.cardLayer.addChild(view);
      }
      this.rotations.set(card.id, card.rotation);
      // Pulled out of a side panel: pop up off the panel and stay lifted while it's carried.
      if (panelDragIds.has(card.id) && this.lift.get(card.id)?.target !== 1) {
        const existing = this.lift.get(card.id);
        if (existing) existing.target = 1;
        else this.lift.set(card.id, { value: reducedMotion() ? 0 : PANEL_POP, velocity: 0, target: 1 });
      }
      this.moveTo(card.id, view, card.x, card.y, fresh);
      view.alpha = 1;
      view.cursor = pencil ? 'crosshair' : 'grab';
      const down = faceDown.has(card.id);
      // A pile of different cards always shows the card back.
      view.getChildByLabel('back')!.visible = down || !pileTop(card);
      const tags = view.getChildByLabel('tags');
      if (tags) tags.visible = !down;
      (view.getChildByLabel('selection') as Graphics).visible = !down && state.selection.includes(card.id);
      const tagNames = card.tagIds.map((id) => state.tags[id]?.name).filter(Boolean) as string[];
      const key = tagNames.join('\u0000');
      if (this.cardTagKeys.get(card.id) !== key) {
        this.cardTagKeys.set(card.id, key);
        this.drawTags(view, tagNames, down);
      }
      const cardIssues = issues[card.id] ?? [];
      const issueKey = cardIssues.map((i) => i.kind).join(',');
      if (this.cardIssueKeys.get(card.id) !== issueKey) {
        this.cardIssueKeys.set(card.id, issueKey);
        this.drawIssues(view, cardIssues);
      }
      const warn = view.getChildByLabel('issues');
      if (warn) warn.visible = !down;
      const count = view.getChildByLabel('count');
      if (count) count.visible = !down;
      const priceTag = view.getChildByLabel('price');
      if (priceTag) priceTag.visible = !down;
    }
    // Drawing order follows the saved card order (stacks look right after reopening).
    const order = Object.keys(state.cards).join(',');
    if (order !== this.cardOrder && !this.drag) {
      this.cardOrder = order;
      this.restack();
    }
  }

  /** A warning badge on the card's top-right corner when it breaks a format rule. */
  private drawIssues(view: Container, issues: Issue[]) {
    view.getChildByLabel('issues')?.destroy({ children: true });
    if (!issues.length) return;
    const layer = new Container();
    layer.label = 'issues';
    // Banned / not legal are red; only over the copy limit is amber.
    const color = issues.some((i) => i.kind !== 'too_many') ? 0xd8453a : 0xd99a26;
    const badge = new Graphics().circle(0, 0, 26).fill(color).stroke({ width: 4, color: colors.tableBg });
    const mark = new Text({ text: '!', style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 34, fontWeight: '800', fill: 0xffffff } });
    mark.anchor.set(0.5);
    layer.addChild(badge, mark);
    layer.position.set(CARD_WIDTH - 14, 14);
    view.addChild(layer);
  }

  /** Resting on a merged card for a moment shows its printings. */
  private peekTimer: ReturnType<typeof setTimeout> | undefined;
  private peekId: string | null = null;
  private updatePeek(e: FederatedPointerEvent) {
    const p = this.world.toLocal(e.global);
    const card = cardAt(useTable.getState(), p.x, p.y);
    const id = card && card.copies.length > 1 ? card.id : null;
    const { clientX, clientY } = e;
    if (id === this.peekId) {
      const shown = usePeek.getState().peek;
      if (id && shown) usePeek.getState().show(id, clientX, clientY);
      return;
    }
    this.clearPeek();
    this.peekId = id;
    if (id) this.peekTimer = setTimeout(() => usePeek.getState().show(id, clientX, clientY), 450);
  }

  private clearPeek() {
    clearTimeout(this.peekTimer);
    this.peekId = null;
    usePeek.getState().hide();
  }

  /** Tooltip with the card's legality problems while hovering it. */
  private updateIssueTooltip(e: FederatedPointerEvent) {
    const p = this.world.toLocal(e.global);
    const card = cardAt(useTable.getState(), p.x, p.y);
    const issues = card ? useDeckCheck.getState().cardIssues[card.id] : undefined;
    const title = issues ? `${card!.copies[0].data.name}: ${issues.map((i) => i.text).join('; ')}` : '';
    if (this.host.title !== title) this.host.title = title;
  }

  // ---- motion ----------------------------------------------------------

  /**
   * Put a card view where the store says. Dragged and brand-new cards go
   * straight there; any other move glides (a sorted view re-laying out, a snap
   * after a drop, a throw sliding to a stop, an undo).
   */
  private moveTo(id: string, view: Container, x: number, y: number, fresh: boolean) {
    const target = this.targets.get(id);
    if (target && target.x === x && target.y === y && !fresh) return;
    this.targets.set(id, { x, y });
    const dragged = (this.drag?.kind === 'cards' && this.drag.ids.includes(id)) || panelDragIds.has(id);
    const from = this.base.get(id);
    if (fresh || dragged || !from) {
      this.tweens.delete(id);
      this.base.set(id, { x, y });
    } else {
      this.tweens.set(id, { fromX: from.x, fromY: from.y, toX: x, toY: y, start: performance.now(), duration: this.glideMs ?? GLIDE_MS });
    }
    this.render(id, view);
  }

  /**
   * Draw a card at its base spot: grown, raised and shadowed by how lifted it
   * is (pressed slightly smaller while it lands), and tilted by its sway. Scale
   * and tilt both turn about the card's center.
   */
  private render(id: string, view: Container) {
    const b = this.base.get(id);
    if (!b) return;
    const l = this.lift.get(id)?.value ?? 0;
    const h = this.hover.get(id);
    const hv = h ? Math.max(0, h.value) : 0;
    const scale = liftScale(l) * (1 + (HOVER_SCALE - 1) * hv);
    const sx = h ? h.slide.x * hv : 0;
    const sy = h ? h.slide.y * hv : 0;
    const rotation = (this.rotations.get(id) ?? 0) + (this.tilt.get(id)?.value ?? 0);
    const flip = this.flips.get(id);
    const turn = flip === undefined ? 1 : Math.max(0.02, easeOut(Math.min(1, (performance.now() - flip) / FLIP_MS)));
    view.scale.set(scale * turn, scale);
    view.rotation = rotation;
    // Keep the anchor where it belongs: position = anchor - rotated, scaled anchor offset.
    // The anchor is the card's center, moving to the hovered spot as the card magnifies.
    const ax = CARD_WIDTH / 2 + (h ? (h.anchor.x - CARD_WIDTH / 2) * hv : 0);
    const ay = CARD_HEIGHT / 2 + (h ? (h.anchor.y - CARD_HEIGHT / 2) * hv : 0);
    const hx = ax * scale * turn;
    const hy = ay * scale;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    view.position.set(b.x + sx + ax - (hx * cos - hy * sin), b.y + sy + ay - (hx * sin + hy * cos) - LIFT_RISE * Math.max(0, l));
    const shadow = view.getChildByLabel('shadow');
    if (shadow) shadow.alpha = Math.max(0, Math.min(1, Math.max(l, hv)));
  }

  private setLift(ids: string[], target: number) {
    for (const id of ids) {
      const s = this.lift.get(id);
      if (s) s.target = target;
      else if (target !== 0) this.lift.set(id, { value: 0, velocity: 0, target });
    }
  }

  /** Cards being carried right now: by the pointer on the table, or out of a side panel. */
  private carried(): Set<string> {
    const ids = new Set(panelDragIds);
    if (this.drag?.kind === 'cards') for (const id of this.drag.ids) ids.add(id);
    return ids;
  }

  private tick = () => {
    if (!this.tweens.size && !this.lift.size && !this.tilt.size && !this.flips.size && !this.hover.size) return;
    const now = performance.now();
    const dt = Math.min(64, this.app.ticker.deltaMS);
    const touched = new Set<string>();
    const carried = this.carried();
    const calm = reducedMotion();
    for (const [id, tw] of this.tweens) {
      const t = Math.min(1, (now - tw.start) / tw.duration);
      const k = easeOut(t);
      this.base.set(id, { x: tw.fromX + (tw.toX - tw.fromX) * k, y: tw.fromY + (tw.toY - tw.fromY) * k });
      if (t >= 1) this.tweens.delete(id);
      touched.add(id);
    }
    for (const [id, l] of this.lift) {
      // Let go (or put back): settle down onto the table.
      if (l.target !== 0 && !carried.has(id)) l.target = 0;
      if (calm) {
        l.value += (l.target - l.value) * Math.min(1, dt / 90);
        l.velocity = 0;
      } else stepSpring(l, dt, LIFT_FREQ, LIFT_DAMPING);
      if (settled(l) || (calm && Math.abs(l.target - l.value) < 0.01)) {
        l.value = l.target;
        l.velocity = 0;
        if (l.target === 0) this.lift.delete(id);
      }
      touched.add(id);
    }
    // Sway: a carried card leans the way it's moving, like a real card held by its middle, and swings back upright when it stops.
    const zoom = useTable.getState().camera.zoom;
    if (!calm) {
      for (const id of carried) {
        const b = this.base.get(id);
        if (!b) continue;
        let t = this.tilt.get(id);
        if (!t) this.tilt.set(id, (t = { value: 0, velocity: 0, target: 0, speed: 0, lastX: b.x }));
        const speed = ((b.x - t.lastX) * zoom) / Math.max(1, dt);
        t.lastX = b.x;
        t.speed += (speed - t.speed) * 0.35;
        t.target = Math.max(-TILT_MAX, Math.min(TILT_MAX, t.speed * TILT_PER_SPEED));
      }
    }
    for (const [id, t] of this.tilt) {
      if (!carried.has(id) || calm) {
        t.target = 0;
        t.speed = 0;
      }
      stepSpring(t, dt, TILT_FREQ, TILT_DAMPING);
      if (!carried.has(id) && settled(t)) this.tilt.delete(id);
      touched.add(id);
    }
    let unhovered = false;
    for (const [id, h] of this.hover) {
      if (calm) h.value = h.target;
      else stepSpring(h, dt, HOVER_FREQ, HOVER_DAMPING);
      if (h.target === 0 && (calm || (h.value < 0.01 && Math.abs(h.velocity) < 0.001))) {
        this.hover.delete(id);
        unhovered = true;
      }
      touched.add(id);
    }
    // A card that's back to normal size goes back to its own layer.
    if (unhovered) this.restack();
    for (const [id, start] of this.flips) {
      if (now - start >= FLIP_MS) this.flips.delete(id);
      touched.add(id);
    }
    // The panel's cover image follows the lead card's pose (board/cardDrag.ts).
    const lead = [...panelDragIds].pop();
    if (lead) {
      const l = this.lift.get(lead)?.value ?? 0;
      panelDragPose.scale = liftScale(l);
      panelDragPose.rise = LIFT_RISE * Math.max(0, l);
      panelDragPose.tilt = this.tilt.get(lead)?.value ?? 0;
    }
    for (const id of touched) {
      const view = this.cardViews.get(id);
      if (view && !view.destroyed) this.render(id, view);
    }
  };

  /** How fast the pointer was moving when cards were let go (table px per ms), over its last ~100 ms of movement. */
  private releaseVelocity(): { vx: number; vy: number } {
    // A pause before letting go (no movement in the last 100 ms) is a drop, not a throw.
    const b = this.dragSamples[this.dragSamples.length - 1];
    if (!b || performance.now() - b.t > 100) return { vx: 0, vy: 0 };
    const recent = this.dragSamples.filter((s) => b.t - s.t <= 100);
    if (recent.length < 2) return { vx: 0, vy: 0 };
    const a = recent[0];
    const dt = Math.max(1, b.t - a.t);
    const zoom = useTable.getState().camera.zoom;
    return { vx: (b.x - a.x) / dt / zoom, vy: (b.y - a.y) / dt / zoom };
  }

  private createCardView(card: TableCard): Container {
    const c = cardColors(card);
    // A merged pile shows its top printing (see pileTop); a mixed pile shows the back.
    const top = pileTop(card);
    const front = top ?? card.copies[0].data;
    // Turned over: draw the back face (name and type for the placeholder, and its image).
    const data = card.flipped && front.back ? { ...front, name: front.back.name, typeLine: front.back.typeLine } : front;
    const view = new Container();
    view.eventMode = 'static';
    view.cursor = 'grab';

    const face = new Container();
    face.label = 'face';
    face.scale.set(CARD_WIDTH / BASE_W, CARD_HEIGHT / BASE_H);
    const body = new Graphics()
      .roundRect(0, 0, BASE_W, BASE_H, 6).fill(c.frame)
      .roundRect(3, 3, BASE_W - 6, 16, 3).fill(c.strip)
      .rect(7, 22, BASE_W - 14, 70).fill(c.art)
      .roundRect(3, 95, BASE_W - 6, 13, 2).fill(c.strip);
    const name = new Text({
      text: data.name,
      style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 9, fontWeight: '600', fill: 0x1b1b1b },
      resolution: CARD_SCALE * 2,
    });
    name.position.set(6, 6);
    if (name.width > BASE_W - 12) name.width = BASE_W - 12;
    const type = new Text({
      text: data.typeLine,
      style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 7, fill: 0x1b1b1b },
      resolution: CARD_SCALE * 2,
    });
    type.position.set(6, 97);
    if (type.width > BASE_W - 12) type.width = BASE_W - 12;
    face.addChild(body, name, type);
    const selection = new Graphics()
      .roundRect(-5, -5, CARD_WIDTH + 10, CARD_HEIGHT + 10, CARD_RADIUS + 5)
      .stroke({ width: 4, color: colors.accent });
    selection.label = 'selection';
    selection.visible = false;
    const back = cardBack();
    back.label = 'back';
    back.visible = false;

    // Under the card while it's picked up.
    const shadow = new Graphics()
      .roundRect(4, 14, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS + 6)
      .fill({ color: 0x000000, alpha: 0.12 })
      .roundRect(8, 10, CARD_WIDTH - 8, CARD_HEIGHT - 4, CARD_RADIUS)
      .fill({ color: 0x000000, alpha: 0.28 });
    shadow.label = 'shadow';
    shadow.alpha = 0;
    view.addChild(shadow);
    if (card.copies.length > 1) view.addChild(pile(card.copies.length));
    view.addChild(face, back, selection);
    if (card.copies.length > 1) {
      // A merged card: how many copies it holds, on its name strip's right end.
      const count = new Container();
      count.label = 'count';
      const text = new Text({
        text: `×${card.copies.length}`,
        style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 24, fontWeight: '800', fill: colors.onAccent },
      });
      const pill = new Graphics().roundRect(0, 0, text.width + 24, 38, 19).fill(colors.accent).stroke({ width: 3, color: colors.tableBg });
      text.position.set(12, 19 - text.height / 2);
      count.addChild(pill, text);
      // Top-right corner, over the mana cost.
      count.position.set(CARD_WIDTH - pill.width - 10, 10);
      view.addChild(count);
    }
    const price = useSettings.getState().tablePrices ? priceLabel(data) : null;
    if (price) {
      // Settings > Show prices on table cards: on the art's top-right corner, under the merge count.
      const tag = new Container();
      tag.label = 'price';
      const text = new Text({ text: price, style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 22, fontWeight: '700', fill: 0xffffff } });
      const pill = new Graphics().roundRect(0, 0, text.width + 20, 34, 17).fill({ color: 0x0b0c0e, alpha: 0.85 });
      text.position.set(10, 17 - text.height / 2);
      tag.addChild(pill, text);
      tag.position.set(CARD_WIDTH - pill.width - 22, 62);
      view.addChild(tag);
    }
    if (top) {
      const image = shownImage(top, card.flipped);
      if (image) this.loadImage(view, image);
      // Fetch the other side now so turning it over is instant.
      const other = card.flipped ? top.imageKey : top.back?.imageKey;
      if (other) cardTexture(other).catch(() => undefined);
    }
    view.on('pointerdown', (e: FederatedPointerEvent) => this.onCardDown(e, card.id));
    return view;
  }

  /** Swap the drawn placeholder for the real card image once it loads. */
  private loadImage(view: Container, url: string) {
    cardTexture(url)
      .then((texture) => {
        if (view.destroyed) return;
        const sprite = new Sprite(texture);
        sprite.width = CARD_WIDTH;
        sprite.height = CARD_HEIGHT;
        // Right above the placeholder face: over the shadow and a merged card's
        // pile edges, below the card back, selection outline and tags. (A fixed
        // index put it under the pile edges, which hid merged cards' images.)
        const face = view.getChildByLabel('face');
        view.addChildAt(sprite, face ? view.getChildIndex(face) + 1 : 1);
        // The image has its own name and type line; hide the placeholder face.
        if (face) face.visible = false;
      })
      .catch(() => {
        // Keep the placeholder if the image can't load (e.g. offline).
      });
  }

  /** Tags sit on the card like counters, stacked at its bottom-left edge. */
  private drawTags(view: Container, names: string[], down: boolean) {
    view.getChildByLabel('tags')?.destroy({ children: true });
    if (!names.length) return;
    const layer = new Container();
    layer.label = 'tags';
    // At most 5 pills: with more tags, the first 4 and a "…" (the right-click menu lists them all).
    const shown = names.length > MAX_TAGS ? [...names.slice(0, MAX_TAGS - 1), '…'] : names;
    shown.forEach((n, i) => {
      const text = new Text({
        text: n,
        style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 18, fontWeight: '600', fill: colors.onAccent },
      });
      const pill = new Graphics().roundRect(0, 0, text.width + 24, 30, 15).fill(colors.accent);
      const tag = new Container();
      text.position.set(12, 5);
      tag.addChild(pill, text);
      tag.position.set(-10, CARD_HEIGHT - 44 - i * 34);
      layer.addChild(tag);
    });
    view.addChild(layer);
    layer.visible = !down;
  }

  // ---- input -----------------------------------------------------------

  /**
   * Left button with the Pencil, or with Ctrl held. Ctrl is read from the
   * pointer event itself too, so drawing works even if the window missed the
   * Ctrl key press (e.g. focus was elsewhere when it went down).
   */
  private isDrawGesture(e: FederatedPointerEvent) {
    return e.button === 0 && (useTable.getState().activeTool === 'pencil' || e.ctrlKey || e.metaKey);
  }

  private startBox(e: FederatedPointerEvent, cardId?: string) {
    const p = this.world.toLocal(e.global);
    // Area selection adds to what's already selected.
    this.drag = { kind: 'box', startX: p.x, startY: p.y, x: p.x, y: p.y, cardId, base: useTable.getState().selection };
    this.dragPointer = e.pointerId;
  }

  private startDraw(e: FederatedPointerEvent) {
    const p = this.world.toLocal(e.global);
    // Fence corners sit on the grid (Alt draws freely).
    const x = snapToGrid(p.x, e.altKey);
    const y = snapToGrid(p.y, e.altKey);
    this.drag = { kind: 'draw', startX: x, startY: y, x, y };
    this.dragPointer = e.pointerId;
  }

  private onCardDown = (e: FederatedPointerEvent, id: string) => {
    if (this.pinch) return e.stopPropagation();
    this.clearPeek();
    if (this.isDrawGesture(e)) {
      e.stopPropagation();
      this.startDraw(e);
      return;
    }
    if (e.button === 2) {
      // Right-click: options for this card (and the rest of the selection if it's in it).
      e.stopPropagation();
      const t = useTable.getState();
      const ids = t.selection.includes(id) ? t.selection : [id];
      t.select(ids);
      useCardMenu.getState().open(viewportX(e), viewportY(e), ids);
      return;
    }
    if (e.button !== 0) return;
    e.stopPropagation();
    if (e.shiftKey || useTable.getState().activeTool === 'select') {
      // Shift (or the Select tool): a click toggles this card, a drag selects by area (decided on release).
      this.startBox(e, id);
      return;
    }
    const t = useTable.getState();
    const selection = t.selection.includes(id) ? t.selection : [id];
    t.select(selection);
    // The cards keep their layer until the pointer actually moves (see startCarry).
    const cards = useTable.getState().cards;
    const start = Object.fromEntries(selection.filter((c) => cards[c]).map((c) => [c, { x: cards[c].x, y: cards[c].y }]));
    this.drag = { kind: 'cards', ids: selection, lead: id, lastX: e.global.x, lastY: e.global.y, start, started: false, downX: e.global.x, downY: e.global.y };
    this.dragPointer = e.pointerId;
    // Touch: a finger held still on the card opens its menu instead.
    this.cancelLongPress();
    this.cancelLongPress = watchLongPress(e.nativeEvent as PointerEvent, () => this.longPressMenu(id, viewportX(e), viewportY(e)));
    this.dragSamples = [{ t: performance.now(), x: e.global.x, y: e.global.y }];
    // Picked up: snap to the pointer (no glide) and rise a little.
    for (const sid of selection) {
      const c = cards[sid];
      if (!c) continue;
      this.tweens.delete(sid);
      this.base.set(sid, { x: c.x, y: c.y });
      this.targets.set(sid, { x: c.x, y: c.y });
    }
  };

  /** The press became a drag: lift the cards out of their pile and carry them on top. */
  private startCarry(drag: Extract<Drag, { kind: 'cards' }>) {
    drag.started = true;
    this.endHover();
    for (const sid of drag.ids) {
      const h = this.hover.get(sid);
      if (h) h.target = 0;
      const v = this.cardViews.get(sid);
      if (v) this.cardLayer.addChild(v);
    }
    this.setLift(drag.ids, 1);
    startLiveFit(drag.ids);
  }

  /** Draw cards in the saved order, with a hovered card (and anything carried) on top. */
  private restack() {
    for (const id of Object.keys(useTable.getState().cards)) {
      const v = this.cardViews.get(id);
      if (v) this.cardLayer.addChild(v);
    }
    const raised = [...this.hover.keys()].sort((a, b) => Number(a === this.hoverId) - Number(b === this.hoverId));
    for (const id of raised) {
      const v = this.cardViews.get(id);
      if (v) this.cardLayer.addChild(v);
    }
    for (const id of this.carried()) {
      const v = this.cardViews.get(id);
      if (v) this.cardLayer.addChild(v);
    }
  }

  // ---- hover magnify -------------------------------------------------------

  private updateCardHover(e: FederatedPointerEvent) {
    const p = this.world.toLocal(e.global);
    const id = cardAt(useTable.getState(), p.x, p.y)?.id ?? null;
    this.lastPointer = { x: p.x, y: p.y };
    // Over the magnified card itself (it covers its neighbours now): keep it.
    if (this.hoverId && this.hoverId !== id && this.overHovered(p)) return;
    if (id === this.hoverId) return;
    this.endHover();
    this.hoverId = id;
    if (id) this.hoverTimer = setTimeout(() => this.beginHover(id, this.lastPointer), HOVER_DELAY);
  }

  /** True when a table point is over the hovered card as it's drawn now (slid out and magnified). */
  private overHovered(p: { x: number; y: number }): boolean {
    const view = this.hoverId ? this.cardViews.get(this.hoverId) : undefined;
    if (!view || !this.hover.has(this.hoverId!)) return false;
    const local = view.toLocal(p, this.world);
    return local.x >= 0 && local.x <= CARD_WIDTH && local.y >= 0 && local.y <= CARD_HEIGHT;
  }

  private beginHover(id: string, pointer: { x: number; y: number }) {
    const t = useTable.getState();
    const card = t.cards[id];
    if (!card || this.drag || this.pinch) return;
    // In a pile (another card lies over this one): slide out of it, back against the way the pile runs,
    // like pulling a card up out of a fanned stack. The part you're pointing at stays under the pointer.
    const ids = Object.keys(t.cards);
    const above = ids
      .slice(ids.indexOf(id) + 1)
      .map((o) => t.cards[o])
      .find((o) => Math.abs(o.x - card.x) < CARD_WIDTH && Math.abs(o.y - card.y) < CARD_HEIGHT);
    let slide = { x: 0, y: 0 };
    if (above) {
      const dx = above.x - card.x;
      const dy = above.y - card.y;
      const len = Math.hypot(dx, dy) || 1;
      slide = { x: (-dx / len) * PILE_SLIDE, y: (-dy / len) * PILE_SLIDE };
    }
    // Magnify about the pointer, so the card grows around the spot you're looking at.
    const anchor = { x: Math.max(0, Math.min(CARD_WIDTH, pointer.x - card.x)), y: Math.max(0, Math.min(CARD_HEIGHT, pointer.y - card.y)) };
    const existing = this.hover.get(id);
    if (existing) {
      existing.target = 1;
      existing.slide = slide;
      existing.anchor = anchor;
    } else this.hover.set(id, { value: 0, velocity: 0, target: 1, slide, anchor });
    this.restack();
  }

  private endHover() {
    clearTimeout(this.hoverTimer);
    const h = this.hoverId ? this.hover.get(this.hoverId) : undefined;
    if (h) h.target = 0;
    this.hoverId = null;
  }


  private onBackgroundDown = (e: FederatedPointerEvent) => {
    if (this.pinch) return;
    if (this.isDrawGesture(e)) return this.startDraw(e);
    useCardMenu.getState().close();
    this.endHover();
    if (e.button !== 0) return;
    // No hover on a touch screen: touching a fence shows its options.
    if (e.pointerType === 'touch') this.updateHover(e);
    if (e.shiftKey || useTable.getState().activeTool === 'select') {
      // Shift + drag: select by area.
      this.startBox(e);
      return;
    }
    useTable.getState().select([]);
    this.drag = { kind: 'pan', lastX: e.global.x, lastY: e.global.y };
    this.dragPointer = e.pointerId;
  };

  private onPointerMove = (e: FederatedPointerEvent) => {
    if (this.pinch) return;
    if (this.drag && this.dragPointer !== null && e.pointerId !== this.dragPointer) return;
    if (!this.drag) {
      if (e.pointerType === 'touch') return;
      this.updateIssueTooltip(e);
      this.updatePeek(e);
      this.updateCardHover(e);
      return this.updateHover(e);
    }
    if (this.drag.kind === 'cards' && !this.drag.started) {
      if (Math.hypot(e.global.x - this.drag.downX, e.global.y - this.drag.downY) < DRAG_THRESHOLD) return;
      this.startCarry(this.drag);
    }
    if (this.drag.kind === 'draw' || this.drag.kind === 'box') {
      const p = this.world.toLocal(e.global);
      const snap = this.drag.kind === 'draw';
      this.drag.x = snap ? snapToGrid(p.x, e.altKey) : p.x;
      this.drag.y = snap ? snapToGrid(p.y, e.altKey) : p.y;
      const r = this.drawRect();
      const t = useTable.getState();
      this.drawPreview
        .clear()
        .roundRect(r.x, r.y, r.width, r.height, this.drag.kind === 'box' ? 4 : 12)
        .fill({ color: colors.accent, alpha: 0.06 })
        .stroke({ width: 1.5 / t.camera.zoom, color: colors.accent });
      if (this.drag.kind === 'box' && (r.width >= 4 || r.height >= 4)) {
        // Live selection: every card the box touches.
        const hits = Object.values(t.cards)
          .filter((c) => c.x < r.x + r.width && c.x + CARD_WIDTH > r.x && c.y < r.y + r.height && c.y + CARD_HEIGHT > r.y)
          .map((c) => c.id);
        t.select([...new Set([...this.drag.base, ...hits])]);
      }
      return;
    }
    const dx = e.global.x - this.drag.lastX;
    const dy = e.global.y - this.drag.lastY;
    this.drag.lastX = e.global.x;
    this.drag.lastY = e.global.y;
    const t = useTable.getState();
    if (this.drag.kind === 'pan') t.panBy(dx, dy);
    else {
      const now = performance.now();
      this.dragSamples.push({ t: now, x: e.global.x, y: e.global.y });
      this.dragSamples = this.dragSamples.filter((s) => now - s.t < 200);
      t.moveCards(this.drag.ids, dx / t.camera.zoom, dy / t.camera.zoom);
      liveFit();
      const overPanel = overRemoveTarget(viewportX(e), viewportY(e));
      this.setPanelDropTarget(overPanel);
      useLandingPreview.getState().set(overPanel ? null : landingFor(this.drag.ids, this.drag.lead, e.altKey));
    }
  };

  private onPointerUp = (e: FederatedPointerEvent) => {
    if (this.drag && this.dragPointer !== null && e.pointerId !== this.dragPointer) return;
    this.cancelLongPress();
    const drag = this.drag;
    this.drag = null;
    this.dragPointer = null;
    if (drag?.kind === 'cards' && !drag.started) {
      // A click: the card stays exactly where it was, in its own layer.
      this.restack();
    } else if (drag?.kind === 'cards') {
      this.setPanelDropTarget(false);
      this.setLift(drag.ids, 0);
      endLiveFit();
      // Every move from here on (slide, snap, re-sort) is drawn as a glide.
      queueMicrotask(() => (this.glideMs = null));
      useLandingPreview.getState().set(null);
      if (overRemoveTarget(viewportX(e), viewportY(e))) {
        const t = useTable.getState();
        const panel = openPanel();
        if (panel === 'search') {
          // Dropped back onto Search: take the cards off the table.
          t.removeCards(drag.ids);
        } else if (panel === 'decks') {
          // Dropped onto Decks: that card becomes the deck's box cover, and the cards go back.
          const lead = t.cards[drag.lead] ?? t.cards[drag.ids[0]];
          if (lead) setDeckCover(lead.copies[lead.copies.length - 1].data);
          t.placeCards(drag.start);
        } else {
          // Dropped onto Favorites / Collection: add them there, and the cards go back where they were.
          const faces = drag.ids.map((id) => t.cards[id]).filter(Boolean).map((c) => c.copies[0].data);
          const local = useLocalCards.getState();
          const list = panel === 'favorites' ? 'favorites' : openLocalView();
          for (const d of faces) {
            if (list === 'favorites') local.setFavorited(d, true);
            else if (list === 'wishlist') local.setWishlisted(d, true);
            else local.addOwned(d, 1);
          }
          t.placeCards(drag.start);
        }
      } else {
        // Thrown: the cards slide on and slow to a stop, then land there.
        const { vx, vy } = this.releaseVelocity();
        const speed = Math.hypot(vx, vy);
        const minSpeed = e.pointerType === 'touch' ? TOUCH_THROW_MIN_SPEED : THROW_MIN_SPEED;
        if (speed > minSpeed && !e.altKey) {
          const distance = Math.min(THROW_MAX_DISTANCE, (speed * speed) / (2 * THROW_FRICTION));
          this.glideMs = Math.min(900, Math.max(GLIDE_MS, (2 * distance) / speed));
          useTable.getState().moveCards(drag.ids, (vx / speed) * distance, (vy / speed) * distance);
        }
        land(drag.ids, drag.lead, e.altKey);
        settleFences();
      }
    }
    if (drag?.kind === 'box') {
      this.drawPreview.clear();
      const r = this.drawRect(drag);
      // Shift + click (no drag) on a card toggles it in the selection.
      // A finger wobbles more than a mouse: allow a few screen pixels.
      const slop = e.pointerType === 'touch' ? 10 / useTable.getState().camera.zoom : 4;
      const tap = r.width < slop && r.height < slop;
      if (drag.cardId && tap) {
        const t = useTable.getState();
        const id = drag.cardId;
        t.select(t.selection.includes(id) ? t.selection.filter((s) => s !== id) : [...t.selection, id]);
      } else if (tap && useTable.getState().activeTool === 'select') {
        // Select tool: a tap on empty table clears the selection.
        useTable.getState().select([]);
      }
    }
    if (drag?.kind === 'draw') {
      this.drawPreview.clear();
      const r = this.drawRect(drag);
      if (r.width < MIN_FENCE || r.height < MIN_FENCE) return;
      const { camera } = useTable.getState();
      // Ask for the section next to the fence's top-right corner.
      useFenceUi.getState().setPending({
        ...r,
        screenX: (r.x + r.width) * camera.zoom + camera.x + 8,
        screenY: r.y * camera.zoom + camera.y,
      });
    }
  };

  private drawRect(d = this.drag) {
    if (d?.kind !== 'draw' && d?.kind !== 'box') return { x: 0, y: 0, width: 0, height: 0 };
    return {
      x: Math.min(d.startX, d.x),
      y: Math.min(d.startY, d.y),
      width: Math.abs(d.x - d.startX),
      height: Math.abs(d.y - d.startY),
    };
  }

  /** Highlight the side panel while cards hover over it, to show a drop there removes them. */
  private setPanelDropTarget(on: boolean) {
    const panel = document.querySelector<HTMLElement>('[data-remove-drop]');
    if (panel && (panel.dataset.dropActive === 'true') !== on) panel.dataset.dropActive = String(on);
  }

  /** Tell the fence overlay which fence the pointer is over, so it can show options. */
  private updateHover(e: FederatedPointerEvent) {
    const p = this.world.toLocal(e.global);
    const all = useTable.getState().fences;
    // Groups first (they sit on top of their fence), and only the ones showing.
    const fences = Object.values(all).filter((f) => !f.parentId || groupShown(f, all));
    fences.sort((a, b) => Number(!!a.parentId) - Number(!!b.parentId));
    let hovered: string | null = null;
    for (let i = fences.length - 1; i >= 0; i--) {
      const f = fences[i];
      if (p.x >= f.x && p.x <= f.x + f.width && p.y >= f.y - 40 && p.y <= f.y + f.height) {
        hovered = f.id;
        break;
      }
    }
    const ui = useFenceUi.getState();
    if (ui.hoveredFenceId !== hovered) ui.setHovered(hovered);
  }

  private onContextMenu = (e: MouseEvent) => {
    // The right-click menu comes later; for now just keep the browser's menu away.
    e.preventDefault();
  };

  private onLeave = (e: PointerEvent) => {
    // A finger "leaves" every time it lifts; keep a touched fence's options showing.
    if (e.pointerType === 'touch') return;
    this.clearPeek();
    this.endHover();
    useFenceUi.getState().setHovered(null);
  };

  // ---- touch -------------------------------------------------------------

  private onTouchDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.touches.size !== 2) return;
    // Second finger: whatever the first one started becomes a pinch.
    this.cancelLongPress();
    this.cancelDrag();
    this.clearPeek();
    useCardMenu.getState().close();
    this.pinch = this.pinchShape();
  };

  private onTouchMove = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' || !this.touches.has(e.pointerId)) return;
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!this.pinch || this.touches.size < 2) return;
    const next = this.pinchShape();
    const rect = this.host.getBoundingClientRect();
    const t = useTable.getState();
    t.panBy(next.cx - this.pinch.cx, next.cy - this.pinch.cy);
    if (this.pinch.dist > 0 && next.dist > 0) t.zoomAt(next.dist / this.pinch.dist, next.cx - rect.left, next.cy - rect.top);
    this.pinch = next;
  };

  private onTouchUp = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' || !this.touches.delete(e.pointerId)) return;
    // The pinch ends when a finger lifts; the one left behind does nothing until it lifts too.
    if (this.pinch && this.touches.size < 2) this.pinch = null;
  };

  /** Center and spread of the first two fingers. */
  private pinchShape() {
    const [a, b] = [...this.touches.values()];
    return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) };
  }

  /** Stop the current drag where it is (cards land as if dropped, without a throw). */
  private cancelDrag() {
    const drag = this.drag;
    this.drag = null;
    this.dragPointer = null;
    if (!drag) return;
    if (drag.kind === 'cards') {
      this.finishLift(drag.ids);
      land(drag.ids, drag.lead, false);
      settleFences();
    } else if (drag.kind === 'box' || drag.kind === 'draw') this.drawPreview.clear();
  }

  private finishLift(ids: string[]) {
    this.setPanelDropTarget(false);
    this.setLift(ids, 0);
    endLiveFit();
    queueMicrotask(() => (this.glideMs = null));
    useLandingPreview.getState().set(null);
  }

  /** Long-press on a card: put it back where it was picked up and open its menu. */
  private longPressMenu(id: string, clientX: number, clientY: number) {
    const drag = this.drag;
    if (drag?.kind !== 'cards' || drag.lead !== id) return;
    this.drag = null;
    this.dragPointer = null;
    this.finishLift(drag.ids);
    const t = useTable.getState();
    const back = Object.fromEntries(drag.ids.filter((c) => t.cards[c] && drag.start[c]).map((c) => [c, drag.start[c]]));
    // Only nudged under the slop distance: move back without a history step if nothing moved.
    if (Object.entries(back).some(([c, p]) => t.cards[c].x !== p.x || t.cards[c].y !== p.y)) t.placeCards(back);
    const ids = t.selection.includes(id) ? t.selection : [id];
    t.select(ids);
    useCardMenu.getState().open(clientX, clientY, ids);
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.clearPeek();
    const rect = this.host.getBoundingClientRect();
    const factor = Math.exp(-e.deltaY * 0.0015);
    useTable.getState().zoomAt(factor, e.clientX - rect.left, e.clientY - rect.top);
  };
}
