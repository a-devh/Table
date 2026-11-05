// Phone and touch detection, shared by the layout and the table's input code.
// Desktop (mouse, wide window) keeps every control exactly as it was.
import { useSyncExternalStore } from 'react';

/** Narrow screens get the phone layout: bottom tab bar, panels as full-screen sheets. */
export const PHONE_QUERY = '(max-width: 700px)';
/** A finger is the main pointer: long-press replaces right-click, the Select tool replaces Shift. */
export const TOUCH_QUERY = '(pointer: coarse)';

const matches = (query: string) => typeof window !== 'undefined' && window.matchMedia(query).matches;

export const isPhone = () => matches(PHONE_QUERY);
export const isTouch = () => matches(TOUCH_QUERY);

export function useMedia(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', onChange);
      return () => m.removeEventListener('change', onChange);
    },
    () => matches(query),
  );
}

export const usePhone = () => useMedia(PHONE_QUERY);
export const useTouch = () => useMedia(TOUCH_QUERY);

/** Fired on window when a card dragged out of a side panel is let go. */
export const PANEL_DRAG_END = 'table:panel-drag-end';

/** How long a finger rests on a card before its menu opens (ms), and how far it may wander (px). */
export const LONG_PRESS_MS = 480;
export const LONG_PRESS_SLOP = 10;

/**
 * Calls `onPress` if a touch pointer stays put for LONG_PRESS_MS. Returns a
 * cancel function; moving, lifting or the browser taking over cancels it too.
 */
export function watchLongPress(e: { pointerId: number; pointerType: string; clientX: number; clientY: number }, onPress: () => void) {
  if (e.pointerType !== 'touch') return () => {};
  const { pointerId, clientX: x0, clientY: y0 } = e;
  const cancel = () => {
    clearTimeout(timer);
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', end, true);
    window.removeEventListener('pointercancel', end, true);
  };
  const move = (ev: PointerEvent) => {
    if (ev.pointerId === pointerId && Math.hypot(ev.clientX - x0, ev.clientY - y0) > LONG_PRESS_SLOP) cancel();
  };
  const end = (ev: PointerEvent) => ev.pointerId === pointerId && cancel();
  const timer = window.setTimeout(() => {
    cancel();
    navigator.vibrate?.(10);
    onPress();
  }, LONG_PRESS_MS);
  window.addEventListener('pointermove', move, true);
  window.addEventListener('pointerup', end, true);
  window.addEventListener('pointercancel', end, true);
  return cancel;
}

/** "Right-click" on a mouse, "Long-press" on a touch screen, for hints. */
export const menuGesture = () => (isTouch() ? 'Long-press' : 'Right-click');

/** Keep Safari's own pinch-zoom and double-tap zoom off the app; the table zooms itself. */
export function startTouchGuards() {
  for (const type of ['gesturestart', 'gesturechange']) document.addEventListener(type, (e) => e.preventDefault());
}
