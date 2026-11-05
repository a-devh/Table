// The compact controls under the search box: two rows of small buttons
// (Unique, Sets, Sort / Color, Type, Rarity), each opening a short menu below.
// Filter buttons add Scryfall syntax to the one search query.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ColorMode, SearchParams, SetInfo, Show, SortDir, SortKey } from './scryfall';
import { TYPE_ORDER } from '../rules/cardTypes';
import { ManaSymbol, RaritySymbol, TypeSymbol } from '../app/ManaSymbol';
import ui from '../app/ui.module.css';
import styles from './SearchControls.module.css';

const SHOW_OPTIONS: { value: Show; label: string; hint: string }[] = [
  { value: 'cards', label: 'Unique card', hint: 'One result per card name' },
  { value: 'prints', label: 'Unique print', hint: 'Every printing' },
  { value: 'art', label: 'Unique art', hint: 'One result per artwork' },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'cmc', label: 'CMC' },
  { value: 'color', label: 'Color' },
  { value: 'identity', label: 'Color identity' },
  { value: 'rarity', label: 'Rarity' },
  { value: 'type', label: 'Type' },
  { value: 'usd', label: 'Price' },
  { value: 'edhrec', label: 'EDHREC' },
];

const COLORS = ['W', 'U', 'B', 'R', 'G', 'C'];
const COLOR_MODES: { value: ColorMode; label: string; hint: string }[] = [
  { value: 'any', label: 'Any of', hint: 'At least one of these colors' },
  { value: 'all', label: 'All of', hint: 'Every one of these, maybe more' },
  { value: 'exact', label: 'Exactly', hint: 'These colors and no others' },
  { value: 'within', label: 'Within', hint: 'Color identity inside these colors (fits a commander), no colorless unless C is picked' },
];
const RARITIES = [
  { value: 'common', label: 'Common' },
  { value: 'uncommon', label: 'Uncommon' },
  { value: 'rare', label: 'Rare' },
  { value: 'mythic', label: 'Mythic' },
];

type Menu = 'show' | 'sets' | 'sort' | 'color' | 'type' | 'rarity';

/** Add or remove one value from a list. */
const toggled = (list: string[] = [], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
/** Chip text for a multi-pick filter: its name, the one pick, or a count. */
const summary = (name: string, picked: string[] = [], label: (v: string) => string, plural: string) =>
  picked.length === 0 ? name : picked.length === 1 ? label(picked[0]) : `${picked.length} ${plural}`;

interface Props {
  params: SearchParams;
  sets: SetInfo[];
  update: (patch: Partial<SearchParams>) => void;
}

export function SearchControls({ params, sets, update }: Props) {
  const [open, setOpen] = useState<Menu | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // Close on a click elsewhere or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const set = sets.find((s) => s.code === params.set);
  const chip = (menu: Menu, label: React.ReactNode, title: string, active = false) => (
    <button
      type="button"
      className={styles.chip}
      aria-expanded={open === menu}
      data-active={active || undefined}
      title={title}
      onClick={() => setOpen((o) => (o === menu ? null : menu))}
    >
      {label}
      <span aria-hidden className={styles.caret}>
        ▾
      </span>
    </button>
  );
  const pick = (patch: Partial<SearchParams>) => {
    update(patch);
    setOpen(null);
  };

  const colors = params.colors ?? [];
  const types = params.types ?? [];
  const rarities = params.rarities ?? [];

  return (
    <div ref={root} className={styles.controls}>
      <div className={styles.row}>
        {chip('show', SHOW_OPTIONS.find((o) => o.value === params.show)?.label ?? 'Unique', 'Show')}
        {chip('sets', set ? <SetLabel set={set} /> : 'All sets', set ? `Set: ${set.name}` : 'Set', !!set)}
        {chip('sort', `${SORT_OPTIONS.find((o) => o.value === params.sort)?.label ?? 'Sort'} ${params.dir === 'asc' ? '↑' : '↓'}`, 'Sort')}
      </div>
      <div className={styles.row}>
        {chip(
          'color',
          colors.length ? (
            <span className={styles.pips}>
              {colors.map((c) => (
                <ManaSymbol key={c} color={c} size={15} />
              ))}
            </span>
          ) : (
            'Color'
          ),
          'Color',
          colors.length > 0,
        )}
        {chip(
          'type',
          // One pick shows its name; several show their icons.
          types.length > 1 ? (
            <span className={styles.pips}>
              {types.map((t) => (
                <TypeSymbol key={t} type={t} size={14} />
              ))}
            </span>
          ) : (
            summary('Type', types, (t) => t, 'types')
          ),
          'Type',
          types.length > 0,
        )}
        {chip(
          'rarity',
          rarities.length ? (
            <span className={styles.pips}>
              {rarities.map((r) => (
                <RaritySymbol key={r} rarity={r} size={15} />
              ))}
              {rarities.length === 1 && <span>{RARITIES.find((x) => x.value === rarities[0])?.label}</span>}
            </span>
          ) : (
            'Rarity'
          ),
          'Rarity',
          rarities.length > 0,
        )}
      </div>

      {open === 'show' && (
        <div role="menu" aria-label="Show" className={styles.menu}>
          {SHOW_OPTIONS.map((o) => (
            <button key={o.value} role="menuitemradio" aria-checked={params.show === o.value} className={styles.item} onClick={() => pick({ show: o.value })}>
              <span>{o.label}</span>
              <small>{o.hint}</small>
            </button>
          ))}
        </div>
      )}
      {open === 'sort' && (
        <div role="menu" aria-label="Sort" className={styles.menu}>
          {SORT_OPTIONS.map((o) => (
            <button key={o.value} role="menuitemradio" aria-checked={params.sort === o.value} className={styles.item} onClick={() => pick({ sort: o.value })}>
              <span>{o.label}</span>
            </button>
          ))}
          <div className={styles.dirRow}>
            {(['asc', 'desc'] as SortDir[]).map((d) => (
              <button key={d} className={styles.dir} aria-pressed={params.dir === d} onClick={() => pick({ dir: d })}>
                {d === 'asc' ? '↑ Ascending' : '↓ Descending'}
              </button>
            ))}
          </div>
        </div>
      )}
      {open === 'color' && (
        <div role="menu" aria-label="Color" className={styles.menu}>
          <div className={styles.colorRow}>
            {COLORS.map((c) => (
              <button key={c} className={styles.colorButton} aria-pressed={colors.includes(c)} onClick={() => update({ colors: toggled(colors, c) })}>
                <ManaSymbol color={c} size={24} />
              </button>
            ))}
          </div>
          {COLOR_MODES.map((m) => (
            <button
              key={m.value}
              role="menuitemradio"
              aria-checked={(params.colorMode ?? 'any') === m.value}
              className={styles.item}
              onClick={() => update({ colorMode: m.value })}
            >
              <span>{m.label}</span>
              <small>{m.hint}</small>
            </button>
          ))}
          {colors.length > 0 && (
            <button className={styles.clear} onClick={() => update({ colors: [] })}>
              Clear colors
            </button>
          )}
        </div>
      )}
      {open === 'type' && (
        <div role="menu" aria-label="Type" className={styles.menu}>
          {TYPE_ORDER.map((t) => (
            <label key={t} className={styles.check}>
              <input type="checkbox" checked={types.includes(t)} onChange={() => update({ types: toggled(types, t) })} />
              <TypeSymbol type={t} />
              <span>{t}</span>
            </label>
          ))}
          {types.length > 0 && (
            <button className={styles.clear} onClick={() => update({ types: [] })}>
              Clear types
            </button>
          )}
        </div>
      )}
      {open === 'rarity' && (
        <div role="menu" aria-label="Rarity" className={styles.menu}>
          {RARITIES.map((r) => (
            <label key={r.value} className={styles.check}>
              <input type="checkbox" checked={rarities.includes(r.value)} onChange={() => update({ rarities: toggled(rarities, r.value) })} />
              <RaritySymbol rarity={r.value} size={18} />
              <span>{r.label}</span>
            </label>
          ))}
          {rarities.length > 0 && (
            <button className={styles.clear} onClick={() => update({ rarities: [] })}>
              Clear rarities
            </button>
          )}
        </div>
      )}
      {open === 'sets' && <SetMenu sets={sets} value={params.set} onPick={(code) => pick({ set: code })} />}
    </div>
  );
}

function SetLabel({ set }: { set: SetInfo }) {
  return (
    <>
      {set.icon && <img src={set.icon} alt="" className={styles.chipIcon} />}
      {set.code.toUpperCase()}
    </>
  );
}

function SetMenu({ sets, value, onPick }: { sets: SetInfo[]; value: string; onPick: (code: string) => void }) {
  const [filter, setFilter] = useState('');
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? sets.filter((s) => s.name.toLowerCase().includes(f) || s.code.includes(f)) : sets;
  }, [sets, filter]);
  return (
    <div role="menu" aria-label="Sets" className={styles.menu}>
      <input
        autoFocus
        aria-label="Filter sets"
        className={ui.input}
        placeholder="Filter by name or code"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className={styles.setList}>
        {!filter && (
          <button role="menuitemradio" aria-checked={!value} className={styles.item} onClick={() => onPick('')}>
            <span>All sets</span>
          </button>
        )}
        {!sets.length && <p className={styles.empty}>Couldn't load the set list from Scryfall.</p>}
        {shown.slice(0, 300).map((s) => (
          <button key={s.code} role="menuitemradio" aria-checked={value === s.code} className={styles.setItem} onClick={() => onPick(s.code)}>
            {s.icon ? <img src={s.icon} alt="" className={styles.setIcon} loading="lazy" /> : <span className={styles.setIcon} />}
            <span className={styles.setName}>{s.name}</span>
            <span className={styles.setMeta}>{s.code.toUpperCase()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
