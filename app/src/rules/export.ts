// Deck list export. Pure: table state in, text out.
// Sections come from fences (by center point). Fences sharing a section merge.
import { fenceOf, groupOf } from '../model/derived';
import type { CardCopy, TableState } from '../model/types';
import { groupCards } from '../fences/layout';

export type ExportFormat = 'text' | 'arena' | 'mtgo';

export interface ExportOptions {
  format: ExportFormat;
  /** Cards outside every fence go under "Misc." (text) or the main deck (Arena/MTGO). */
  includeMisc: boolean;
}

const SECTION_ORDER = ['Commander', 'Main', 'Sideboard', 'Maybeboard'];
export const MISC = 'Misc.';

interface Section {
  name: string;
  /** Sub-headers from a sorted fence view (text export only). */
  groups: { label: string; copies: CardCopy[] }[];
}

function collectSections(state: TableState, includeMisc: boolean): Section[] {
  const fences = Object.values(state.fences);
  const bySection = new Map<string, Section>();
  const add = (name: string, label: string, copies: CardCopy[]) => {
    const section = bySection.get(name) ?? { name, groups: [] };
    const group = section.groups.find((g) => g.label === label);
    if (group) group.copies.push(...copies);
    else section.groups.push({ label, copies: [...copies] });
    bySection.set(name, section);
  };
  for (const f of fences) {
    if (f.parentId) continue; // groups are written under their fence
    const members = Object.values(state.cards).filter((c) => fenceOf(c, fences)?.id === f.id);
    if (f.view === 'custom') {
      // Cards in the fence's groups go under the group's name.
      const ungrouped = members.filter((c) => !groupOf(c, fences));
      add(f.section, '', ungrouped.flatMap((c) => c.copies));
      for (const g of fences.filter((g) => g.parentId === f.id)) {
        add(f.section, g.name, members.filter((c) => groupOf(c, fences)?.id === g.id).flatMap((c) => c.copies));
      }
    }
    else for (const g of groupCards(members, f.view, state.tags)) add(f.section, g.label, g.cards.flatMap((c) => c.copies));
  }
  if (includeMisc) {
    const loose = Object.values(state.cards).filter((c) => !fenceOf(c, fences));
    if (loose.length) add(MISC, '', loose.flatMap((c) => c.copies));
  }
  const rank = (n: string) => (SECTION_ORDER.includes(n) ? SECTION_ORDER.indexOf(n) : n === MISC ? 99 : 50);
  return [...bySection.values()].filter((s) => s.groups.some((g) => g.copies.length)).sort((a, b) => rank(a.name) - rank(b.name));
}

/** One line per card name (text, MTGO) or per printing (Arena), with counts. */
function cardLines(copies: CardCopy[], withPrinting: boolean, frontFaceOnly = withPrinting): string[] {
  const counts = new Map<string, number>();
  for (const { data } of copies) {
    // Arena and MTGO want only the front face of double-faced cards.
    const name = frontFaceOnly ? data.name.split(' // ')[0] : data.name;
    const key = withPrinting ? `${name} (${data.set.toUpperCase()}) ${data.collectorNumber}` : name;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, n]) => `${n} ${key}`);
}

const total = (s: Section) => s.groups.reduce((n, g) => n + g.copies.length, 0);

export function exportDeck(state: TableState, options: ExportOptions): string {
  const sections = collectSections(state, options.includeMisc);

  if (options.format === 'text') {
    return sections
      .map((s) => {
        const body = s.groups.flatMap((g) => (g.label ? [`  ${g.label}`, ...cardLines(g.copies, false).map((l) => `  ${l}`)] : cardLines(g.copies, false)));
        return [`${s.name} (${total(s)})`, ...body].join('\n');
      })
      .join('\n\n');
  }

  // Arena and MTGO only know a few zones. Custom sections and Misc. join the
  // main deck; the Maybeboard is left out.
  const zone = (name: string) => (name === 'Commander' || name === 'Sideboard' || name === 'Maybeboard' ? name : 'Deck');
  const zones = new Map<string, CardCopy[]>();
  for (const s of sections) {
    const z = zone(s.name);
    if (z === 'Maybeboard') continue;
    zones.set(z, [...(zones.get(z) ?? []), ...s.groups.flatMap((g) => g.copies)]);
  }

  if (options.format === 'arena') {
    return ['Commander', 'Deck', 'Sideboard']
      .filter((z) => zones.get(z)?.length)
      .map((z) => [z, ...cardLines(zones.get(z)!, true)].join('\n'))
      .join('\n\n');
  }

  // MTGO: main deck, a blank line, then the sideboard (the commander goes there too).
  const main = cardLines(zones.get('Deck') ?? [], false, true);
  const side = cardLines([...(zones.get('Commander') ?? []), ...(zones.get('Sideboard') ?? [])], false, true);
  return side.length ? `${main.join('\n')}\n\n${side.join('\n')}` : main.join('\n');
}
