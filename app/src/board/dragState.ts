// Cards being dragged in from a side panel. The table draws these straight at
// the pointer instead of gliding them.
export const panelDragIds = new Set<string>();

/**
 * How the lead card of a panel drag is drawn right now (set by the table each
 * frame), so the cover image over the panel can match it.
 */
export const panelDragPose = {
  /** Size factor (1 = normal). */
  scale: 1,
  /** How far it's raised, in table px. */
  rise: 0,
  /** Sway, in radians. */
  tilt: 0,
};
