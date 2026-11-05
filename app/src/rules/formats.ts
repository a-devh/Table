// Formats: zones with card counts, a copy limit, and legality (sets + banned
// cards). Built-in formats live here; custom formats come from the Add Format
// dialog (src/formats/) and use the same shape.
export interface Zone {
  name: string;
  /** How many cards the zone holds. The first zone is the library. */
  count: number;
}

export interface Format {
  id: string;
  label: string;
  zones: Zone[];
  /** Copies allowed of any card except basic lands. 1 = singleton. */
  maxCopies: number;
  /** Custom formats: extra legal sets (added to the base) or illegal sets (taken out). */
  sets: { mode: 'legal' | 'illegal'; codes: string[] };
  /** Banned card names. */
  banned: string[];
  /**
   * Scryfall legality key. Built-in formats: the format itself. Custom formats:
   * the base format they start from (its legal cards are legal, plus or minus
   * the listed sets).
   */
  legality?: string;
  custom?: boolean;
}

const ALL_SETS = { mode: 'illegal' as const, codes: [] };
const constructed = (id: string, label: string, legality?: string): Format => ({
  id,
  label,
  zones: [
    { name: 'Main', count: 60 },
    { name: 'Sideboard', count: 15 },
  ],
  maxCopies: 4,
  sets: ALL_SETS,
  banned: [],
  legality,
});

export const BUILT_IN_FORMATS: Format[] = [
  constructed('none', 'No format'),
  constructed('standard', 'Standard', 'standard'),
  constructed('pioneer', 'Pioneer', 'pioneer'),
  constructed('modern', 'Modern', 'modern'),
  constructed('legacy', 'Legacy', 'legacy'),
  constructed('vintage', 'Vintage', 'vintage'),
  constructed('pauper', 'Pauper', 'pauper'),
  {
    id: 'commander',
    label: 'Commander',
    zones: [
      { name: 'Main', count: 99 },
      { name: 'Commander', count: 1 },
    ],
    maxCopies: 1,
    sets: ALL_SETS,
    banned: [],
    legality: 'commander',
  },
  { ...constructed('limited', 'Limited'), zones: [{ name: 'Main', count: 40 }], maxCopies: 99 },
];

/** Formats a custom format can start from (Scryfall legality keys). */
export const BASE_FORMATS: { key: string; label: string }[] = [
  ...BUILT_IN_FORMATS.filter((f) => f.legality).map((f) => ({ key: f.legality!, label: f.label })),
  { key: 'premodern', label: 'Premodern' },
  { key: 'oldschool', label: 'Old School 93/94' },
];

/** Find a format among the built-ins and the given custom formats. */
export function findFormat(id: string, custom: Record<string, Format> = {}): Format {
  return BUILT_IN_FORMATS.find((f) => f.id === id) ?? custom[id] ?? BUILT_IN_FORMATS[0];
}

/** Cards in the library for the mana math: the first zone's count. */
export const deckSize = (f: Format): number => f.zones[0]?.count ?? 60;

/** Section names offered when a fence is drawn: the format's zones, then Maybeboard. */
export function zoneNames(f: Format): string[] {
  const names = f.zones.map((z) => z.name);
  return names.includes('Maybeboard') ? names : [...names, 'Maybeboard'];
}
