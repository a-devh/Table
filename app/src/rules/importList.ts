// Deck list import: text in, sections of card lines out. Pure.
// Reads the lists Table exports (plain text, Arena, MTGO) and the common
// pasted forms: "4 Lightning Bolt", "4x Lightning Bolt",
// "1 Lightning Bolt (M10) 146", Moxfield's *F* foil marks, "SB: 2 Duress".

export interface ListEntry {
  count: number;
  name: string;
  /** Printing, when the list names one (Arena / Moxfield). */
  set?: string;
  number?: string;
}

export interface ListSection {
  name: string;
  entries: ListEntry[];
}

/** Header words and the section they mean. Anything else that looks like a header keeps its own name. */
const SECTION_WORDS: Record<string, string> = {
  deck: 'Main',
  main: 'Main',
  maindeck: 'Main',
  mainboard: 'Main',
  'main deck': 'Main',
  commander: 'Commander',
  commanders: 'Commander',
  companion: 'Sideboard',
  sideboard: 'Sideboard',
  side: 'Sideboard',
  maybeboard: 'Maybeboard',
  maybe: 'Maybeboard',
  considering: 'Maybeboard',
};
/** Arena's metadata lines, which aren't cards. */
const SKIP = /^(about|name\s.*)$/i;
const CARD = /^(\d+)\s*x?\s+(.+?)(?:\s+\(([A-Za-z0-9]{2,6})\)(?:\s+(\S+))?)?(?:\s+\*[A-Z]+\*)*$/i;

function headerName(line: string): string | null {
  const bare = line.replace(/^\/\/\s*/, '').replace(/:$/, '').replace(/\s*\(\d+\)$/, '').trim();
  const known = SECTION_WORDS[bare.toLowerCase()];
  if (known) return known;
  // Table's plain-text export: "Section (12)"; any "// Name" or "Name:" line.
  if (/\(\d+\)$/.test(line) || line.startsWith('//') || line.endsWith(':')) return bare === 'Misc.' ? 'Main' : bare;
  return null;
}

export function parseDeckList(text: string): ListSection[] {
  const sections: ListSection[] = [];
  let current: ListSection | null = null;
  let sawHeader = false;
  let blankAfterCards = false;
  const section = (name: string) => {
    let s = sections.find((x) => x.name === name);
    if (!s) sections.push((s = { name, entries: [] }));
    return s;
  };
  for (const raw of text.split(/\r?\n/)) {
    const indented = /^\s+\S/.test(raw);
    let line = raw.trim();
    if (!line) {
      if (current?.entries.length) blankAfterCards = true;
      continue;
    }
    if (SKIP.test(line)) continue;
    let target: string | null = null;
    const sb = /^SB:\s*/i.exec(line);
    if (sb) {
      line = line.slice(sb[0].length);
      target = 'Sideboard';
    }
    const card = CARD.exec(line);
    if (!card) {
      // A sorted-view group label in Table's plain text ("  Creatures") isn't a section.
      if (indented) continue;
      const header = headerName(line);
      if (header) {
        current = section(header);
        sawHeader = true;
        blankAfterCards = false;
        continue;
      }
      // A bare card name counts as one copy.
      (target ? section(target) : (current ??= section('Main'))).entries.push({ count: 1, name: line });
      continue;
    }
    // MTGO: no headers, a blank line, then the sideboard.
    if (!sawHeader && blankAfterCards && current?.name === 'Main') current = section('Sideboard');
    blankAfterCards = false;
    const entry: ListEntry = { count: Number(card[1]), name: card[2].trim() };
    if (card[3]) entry.set = card[3].toLowerCase();
    if (card[4]) entry.number = card[4];
    if (entry.count < 1) continue;
    (target ? section(target) : (current ??= section('Main'))).entries.push(entry);
  }
  return sections.filter((s) => s.entries.length);
}
