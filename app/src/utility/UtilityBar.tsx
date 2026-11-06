// Deck name, format, and file actions (New/Open/Save, Ctrl+N/O/S, Export).
import { useEffect, useState } from 'react';
import { useTable } from '../model/store';
import { isDirty, newTable, openTable, saveTable, useFileState } from './fileState';
import { ExportDialog } from './ExportDialog';
import { ImportDialog } from './ImportDialog';
import { BUILT_IN_FORMATS } from '../rules/formats';
import { useFormats } from '../formats/formatsStore';
import { AddFormatDialog } from '../formats/AddFormatDialog';
import { useDeckCheck } from '../formats/deckCheckStore';
import { usePhone } from '../app/device';
import { MoreIcon } from '../app/icons';

const ADD_FORMAT = '__add-format';
const EDIT_FORMAT = '__edit-format';
import ui from '../app/ui.module.css';
import styles from './utility.module.css';

export function UtilityBar() {
  const deckName = useTable((s) => s.deckName);
  const format = useTable((s) => s.format);
  const renameDeck = useTable((s) => s.renameDeck);
  const setFormat = useTable((s) => s.setFormat);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [addingFormat, setAddingFormat] = useState(false);
  const [editingFormat, setEditingFormat] = useState(false);
  const custom = useFormats((s) => s.custom);
  const check = useDeckCheck();
  const error = useFileState((s) => s.error);
  const saved = useFileState((f) => f.saved);
  const dirty = useTable((t) => isDirty(t, saved));
  const phone = usePhone();
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 's') saveTable(e.shiftKey);
      else if (key === 'o') openTable();
      else if (key === 'n') newTable();
      else if (key === 'i' && !e.shiftKey) setImporting(true);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const fields = (
    <>
      {/* The deck name gives up width first when the table is narrow. */}
      <label className={styles.nameField}>
        <span className={ui.visuallyHidden}>Deck name</span>
        <input
          className={ui.input}
          style={{ width: '100%', fontWeight: 600, borderColor: 'transparent' }}
          value={deckName}
          onChange={(e) => renameDeck(e.target.value)}
        />
      </label>
      <label>
        <span className={ui.visuallyHidden}>Format</span>
        <select
          className={ui.button}
          value={format}
          onChange={(e) =>
            e.target.value === ADD_FORMAT ? setAddingFormat(true) : e.target.value === EDIT_FORMAT ? setEditingFormat(true) : setFormat(e.target.value)
          }
        >
          {BUILT_IN_FORMATS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
          {Object.keys(custom).length > 0 && (
            <optgroup label="Custom">
              {Object.values(custom).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </optgroup>
          )}
          {custom[format] && <option value={EDIT_FORMAT}>✎ Edit {custom[format].label}…</option>}
          <option value={ADD_FORMAT}>+ Add format…</option>
        </select>
      </label>
      {format !== 'none' && (
        <span
          className={styles.legal}
          data-bad={check.problems > 0 || undefined}
          title={
            check.problems
              ? [
                  ...check.zones.filter((z) => !z.ok).map((z) => `${z.zone}: ${z.count} cards, needs ${z.rule} ${z.target}`),
                  ...(Object.keys(check.cardIssues).length ? ['Cards with problems are marked ! on the table'] : []),
                ].join('\n')
              : 'Deck is legal'
          }
        >
          {check.problems ? `✕ ${check.problems}` : '✓ Legal'}
        </span>
      )}
    </>
  );
  const actions = (
    <>
      <button className={ui.button} title="New table (Ctrl+N)" onClick={() => newTable()}>
        New
      </button>
      <button className={ui.button} title="Open a .table file (Ctrl+O)" onClick={() => openTable()}>
        Open
      </button>
      {/* Desktop: Import lives in the Decks panel (and Ctrl+I), keeping this bar short. */}
      {phone && (
        <button className={ui.button} title="Paste a deck list (Arena, Moxfield, MTGO, text)" onClick={() => setImporting(true)}>
          Import
        </button>
      )}
      <button className={ui.button} title={dirty ? 'Unsaved changes (Ctrl+S)' : 'Save (Ctrl+S)'} onClick={() => saveTable()}>
        Save
        {dirty && <span className={styles.dirty} aria-label="unsaved changes" />}
      </button>
      <button className={ui.primary} onClick={() => setExporting(true)}>
        Export
      </button>
    </>
  );
  const dialogs = (
    <>
      {exporting && <ExportDialog onClose={() => setExporting(false)} />}
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
      {addingFormat && (
        <AddFormatDialog
          onClose={() => setAddingFormat(false)}
          onSaved={(id) => {
            setFormat(id);
            setAddingFormat(false);
          }}
        />
      )}
      {editingFormat && custom[format] && (
        <AddFormatDialog
          editing={custom[format]}
          onClose={() => setEditingFormat(false)}
          onSaved={() => setEditingFormat(false)}
          onDeleted={() => {
            setFormat('none');
            setEditingFormat(false);
          }}
        />
      )}
      {error && (
        <div role="alert" className={styles.error}>
          {error}
          <button aria-label="Dismiss" className={ui.iconButton} onClick={() => useFileState.getState().setError(null)}>
            ×
          </button>
        </div>
      )}
    </>
  );

  if (phone) {
    // Phone: one small button; the deck name, format and file actions open in a sheet above the toolbar.
    const flag = format !== 'none' && check.problems > 0;
    return (
      <div role="toolbar" aria-label="Deck" className={ui.bubbleBottom}>
        <button
          aria-label="Deck: name, format, New, Open, Import, Save, Export"
          aria-expanded={sheetOpen}
          aria-pressed={sheetOpen}
          className={ui.iconButton}
          style={{ position: 'relative' }}
          onClick={() => setSheetOpen((o) => !o)}
        >
          <MoreIcon />
          {(dirty || flag) && <span className={styles.badgeDot} data-bad={flag || undefined} />}
        </button>
        {sheetOpen && (
          <>
            <div className={styles.sheetScrim} onPointerDown={() => setSheetOpen(false)} />
            <div role="dialog" aria-label="Deck" className={styles.sheet}>
              <div className={styles.sheetRow}>{fields}</div>
              <div className={styles.sheetRow} onClick={(e) => (e.target as HTMLElement).closest('button') && setSheetOpen(false)}>
                {actions}
              </div>
            </div>
          </>
        )}
        {dialogs}
      </div>
    );
  }

  return (
    <div role="toolbar" aria-label="Deck" className={`${ui.bubbleBottom} ${styles.bar}`}>
      {fields}
      <span className={ui.divider} />
      {actions}
      {dialogs}
    </div>
  );
}
