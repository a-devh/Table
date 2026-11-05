// Settings (gear in the sidebar). For now: the mana math. Theme, snapping,
// merge defaults and the image cache join here as those features land.
import { createPortal } from 'react-dom';
import { isTouch } from '../app/device';
import { useEffect, useState } from 'react';
import { useSettings, type Accent, type ThemeChoice } from './settingsStore';
import { useFormats } from '../formats/formatsStore';
import { AddFormatDialog } from '../formats/AddFormatDialog';
import { useTable } from '../model/store';
import type { Format } from '../rules/formats';
import ui from '../app/ui.module.css';
import styles from './settings.module.css';

const CHANCES = [0.8, 0.85, 0.9, 0.95];

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'Match system' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];
const ACCENTS: Accent[] = ['default', 'amber', 'green', 'violet', 'rose'];

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const math = useSettings((s) => s.manaMath);
  const setManaMath = useSettings((s) => s.setManaMath);
  const gridSnap = useSettings((s) => s.gridSnap);
  const tablePrices = useSettings((s) => s.tablePrices);
  const setTablePrices = useSettings((s) => s.setTablePrices);
  const setGridSnap = useSettings((s) => s.setGridSnap);
  const theme = useSettings((s) => s.theme);
  const accent = useSettings((s) => s.accent);
  const setTheme = useSettings((s) => s.setTheme);
  const setAccent = useSettings((s) => s.setAccent);
  const columns = useSettings((s) => s.searchLayout.columns);
  const setSearchLayout = useSettings((s) => s.setSearchLayout);

  const customFormats = Object.values(useFormats((s) => s.custom)).sort((a, b) => a.label.localeCompare(b.label));
  // The format being edited, or 'new' while adding one.
  const [formatDialog, setFormatDialog] = useState<Format | 'new' | null>(null);

  useEffect(() => {
    // Escape closes the format dialog first, not Settings underneath it.
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !formatDialog && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, formatDialog]);

  const deleteFormat = (f: Format) => {
    useFormats.getState().deleteFormat(f.id);
    if (useTable.getState().format === f.id) useTable.getState().setFormat('none');
  };

  // Rendered at the page root so it sits above everything on the table.
  return createPortal(
    <div className={ui.scrim} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label="Settings" className={ui.dialog}>
        <header className={ui.dialogHeader}>
          <h2>Settings</h2>
          <button aria-label="Close settings" className={ui.iconButton} onClick={onClose}>
            ×
          </button>
        </header>

        <section className={styles.section}>
          <h3>Appearance</h3>
          <label className={styles.row}>
            <span>Theme</span>
            <select className={ui.button} value={theme} onChange={(e) => setTheme(e.target.value as ThemeChoice)}>
              {THEMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.row}>
            <span>Accent color</span>
            <span role="radiogroup" aria-label="Accent color" className={styles.swatches}>
              {ACCENTS.map((a) => (
                <button
                  key={a}
                  role="radio"
                  aria-checked={accent === a}
                  aria-label={a === 'default' ? 'Default' : a[0].toUpperCase() + a.slice(1)}
                  title={a === 'default' ? 'Default' : a[0].toUpperCase() + a.slice(1)}
                  className={styles.swatch}
                  data-swatch={a}
                  onClick={() => setAccent(a)}
                />
              ))}
            </span>
          </div>
        </section>

        <section className={styles.section}>
          <h3>Table</h3>
          <label className={styles.row}>
            <span>
              Snap to grid
              <small>Dropped cards line up on the dotted grid. {isTouch() ? 'Turn it off with the grid button to place freely.' : 'Hold Alt while dragging to place freely.'}</small>
            </span>
            <input type="checkbox" checked={gridSnap} onChange={(e) => setGridSnap(e.target.checked)} />
          </label>
          <label className={styles.row}>
            <span>
              Show prices on table cards
              <small>Each card's USD price on the table (Scryfall, updated daily). Search results always show prices under the card.</small>
            </span>
            <input type="checkbox" checked={tablePrices} onChange={(e) => setTablePrices(e.target.checked)} />
          </label>
        </section>

        <section className={styles.section}>
          <h3>Formats</h3>
          {customFormats.length === 0 && <p className={styles.note}>No custom formats yet.</p>}
          {customFormats.map((f) => (
            <div key={f.id} className={styles.row}>
              <span>
                {f.label}
                <small>
                  {f.zones.map((z) => `${z.name} ${z.count}`).join(' · ')} · {f.maxCopies === 1 ? 'singleton' : `up to ${f.maxCopies}`}
                </small>
              </span>
              <span className={styles.actions}>
                <button className={ui.button} onClick={() => setFormatDialog(f)}>
                  Edit
                </button>
                <ConfirmButton label="Delete" confirm="Delete?" onConfirm={() => deleteFormat(f)} />
              </span>
            </div>
          ))}
          <button className={ui.button} style={{ alignSelf: 'flex-start' }} onClick={() => setFormatDialog('new')}>
            + Add format
          </button>
        </section>

        <section className={styles.section}>
          <h3>Side panels</h3>
          <label className={styles.row}>
            <span>
              Cards per row
              <small>How many cards fit across Search, Favorites and Collection.</small>
            </span>
            <select className={ui.button} value={columns} onChange={(e) => setSearchLayout({ columns: Number(e.target.value) })}>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className={styles.section}>
          <h3>Mana math</h3>
          <label className={styles.row}>
            <span>
              Cast on curve
              <small>How often each color's hardest spell should be castable on its turn.</small>
            </span>
            <select className={ui.button} value={math.castChance} onChange={(e) => setManaMath({ castChance: Number(e.target.value) })}>
              {CHANCES.map((c) => (
                <option key={c} value={c}>
                  {Math.round(c * 100)}%{c === 0.9 ? ' (Karsten)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.row}>
            <span>
              Turn order
              <small>On the draw you see one more card by each turn, so you need slightly fewer sources.</small>
            </span>
            <select className={ui.button} value={math.onTheDraw ? 'draw' : 'play'} onChange={(e) => setManaMath({ onTheDraw: e.target.value === 'draw' })}>
              <option value="play">On the play</option>
              <option value="draw">On the draw</option>
            </select>
          </label>
        </section>

      </div>
      {formatDialog && (
        <AddFormatDialog
          editing={formatDialog === 'new' ? undefined : formatDialog}
          onClose={() => setFormatDialog(null)}
          onSaved={() => setFormatDialog(null)}
          onDeleted={(id) => {
            if (useTable.getState().format === id) useTable.getState().setFormat('none');
            setFormatDialog(null);
          }}
        />
      )}
    </div>,
    document.body,
  );
}

/** A button that asks once more before doing something that can't be undone. */
function ConfirmButton({ label, confirm, onConfirm }: { label: string; confirm: string; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false);
  return (
    <button className={ui.button} data-danger={asking || undefined} onBlur={() => setAsking(false)} onClick={() => (asking ? onConfirm() : setAsking(true))}>
      {asking ? confirm : label}
    </button>
  );
}
