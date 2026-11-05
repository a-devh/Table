// Export: pick a list format, preview it, then copy it or save it as .txt.
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import { useTable } from '../model/store';
import { exportDeck, type ExportFormat } from '../rules/export';
import { fileNameFor, saveTextFile } from './fileIO';
import ui from '../app/ui.module.css';
import styles from './utility.module.css';

const FORMATS: { value: ExportFormat; label: string; note: string }[] = [
  { value: 'text', label: 'Plain text', note: 'Every section as a header, with sorted-view groups under it.' },
  { value: 'arena', label: 'Arena', note: 'Commander, Deck and Sideboard with set and number. Also imports into Moxfield. Custom sections join the Deck; the Maybeboard is left out.' },
  { value: 'mtgo', label: 'MTGO', note: 'Main deck, a blank line, then the sideboard (with the commander). Custom sections join the main deck; the Maybeboard is left out.' },
];

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const [format, setFormat] = useState<ExportFormat>('text');
  const [includeMisc, setIncludeMisc] = useState(false);
  const [status, setStatus] = useState('');
  const cards = useTable((s) => s.cards);
  const fences = useTable((s) => s.fences);
  const tags = useTable((s) => s.tags);
  const deckName = useTable((s) => s.deckName);
  const text = useMemo(
    () => exportDeck({ ...useTable.getState(), cards, fences, tags }, { format, includeMisc }),
    [cards, fences, tags, format, includeMisc],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Rendered at the page root so it sits above everything on the table.
  return createPortal(
    <div className={ui.scrim} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label="Export deck" className={ui.dialog}>
        <header className={ui.dialogHeader}>
          <h2>Export</h2>
          <button aria-label="Close export" className={ui.iconButton} onClick={onClose}>
            ×
          </button>
        </header>
        <div className={styles.controls}>
          <label>
            <span className={ui.visuallyHidden}>Export format</span>
            <select className={ui.button} value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={includeMisc} onChange={(e) => setIncludeMisc(e.target.checked)} />
            Include cards outside fences (Misc.)
          </label>
        </div>
        <p className={styles.note}>{FORMATS.find((f) => f.value === format)!.note}</p>
        <textarea aria-label="Export preview" className={styles.preview} readOnly value={text || 'Nothing to export yet: put cards in a fence, or include Misc.'} />
        <footer className={styles.footer}>
          <span className={styles.status} role="status">
            {status}
          </span>
          <button
            className={ui.button}
            disabled={!text}
            onClick={() =>
              navigator.clipboard.writeText(text).then(
                () => setStatus('Copied.'),
                () => setStatus("Couldn't copy. Select the text and copy it instead."),
              )
            }
          >
            Copy
          </button>
          <button
            className={ui.primary}
            disabled={!text}
            onClick={() =>
              saveTextFile(text, { suggestedName: fileNameFor(deckName, 'txt'), kind: 'txt' }).then(
                (path) => path && setStatus(`Saved ${path}`),
                (e) => setStatus(String(e)),
              )
            }
          >
            Save .txt
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
