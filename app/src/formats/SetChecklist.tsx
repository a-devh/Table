// Dropdown checklist of every set (symbol, name, code, year).
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SetInfo } from '../search/scryfall';
import ui from '../app/ui.module.css';
import styles from './formats.module.css';

export function SetChecklist({
  sets,
  selected,
  onChange,
  children,
}: {
  /** Shown before the dropdown button (the legal/illegal rule). */
  children?: React.ReactNode;
  sets: SetInfo[];
  selected: string[];
  onChange: (codes: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const root = useRef<HTMLDivElement>(null);

  // Close when clicking anywhere else. On click (not pointer down), so the
  // layout doesn't shift under a button that's being pressed.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, [open]);

  const chosen = useMemo(() => new Set(selected), [selected]);
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? sets.filter((s) => s.name.toLowerCase().includes(f) || s.code.includes(f)) : sets;
  }, [sets, filter]);

  const toggle = (code: string) => onChange(chosen.has(code) ? selected.filter((c) => c !== code) : [...selected, code]);

  const summary = selected.length === 0 ? 'No sets' : selected.length === 1 ? (sets.find((s) => s.code === selected[0])?.name ?? selected[0].toUpperCase()) : `${selected.length} sets`;

  return (
    <div ref={root} className={styles.dropdown}>
      <div className={styles.inline}>
        {children}
        <button type="button" className={`${ui.button} ${styles.dropdownButton}`} aria-expanded={open} aria-label="Choose sets" onClick={() => setOpen((o) => !o)}>
        <span>{summary}</span>
          <span aria-hidden>▾</span>
        </button>
      </div>
      {open && (
        <div className={styles.dropdownPanel}>
          {selected.length > 0 && (
            <button type="button" className={styles.preset} style={{ alignSelf: 'flex-start' }} onClick={() => onChange([])}>
              Clear {selected.length} selected
            </button>
          )}
          <input aria-label="Filter sets" className={ui.input} placeholder="Filter by name or code" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div role="listbox" aria-multiselectable className={styles.list}>
            {!sets.length && <div className={styles.empty}>Couldn't load the set list from Scryfall.</div>}
            {shown.map((s) => (
              <label key={s.code} role="option" aria-selected={chosen.has(s.code)} className={styles.setRow}>
                <input type="checkbox" checked={chosen.has(s.code)} onChange={() => toggle(s.code)} />
                {s.icon ? <img className={styles.setIcon} src={s.icon} alt="" loading="lazy" /> : <span className={styles.setIcon} />}
                <span className={styles.setName}>{s.name}</span>
                <span className={styles.setMeta}>
                  {s.code.toUpperCase()} · {s.released?.slice(0, 4)}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
