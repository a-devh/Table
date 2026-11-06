// Import: paste a deck list (Arena, Moxfield, MTGO or plain text), name it,
// and it opens on a new table and goes into the deck library.
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { importDeckList } from './importDeck';
import ui from '../app/ui.module.css';
import styles from './utility.module.css';

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const run = async () => {
    setBusy(true);
    setStatus('Looking up cards on Scryfall…');
    setMissing([]);
    try {
      const result = await importDeckList(text, name);
      if (!result) return setStatus('');
      if (!result.missing.length) return onClose();
      setStatus(`Imported ${result.cards} cards and saved the deck to the library. Not found:`);
      setMissing(result.missing);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className={ui.scrim} onPointerDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div role="dialog" aria-label="Import deck" className={ui.dialog}>
        <header className={ui.dialogHeader}>
          <h2>Import</h2>
          <button aria-label="Close import" className={ui.iconButton} onClick={onClose} disabled={busy}>
            ×
          </button>
        </header>
        <input className={ui.input} placeholder="Deck name" aria-label="Deck name" value={name} onChange={(e) => setName(e.target.value)} />
        <p className={styles.note}>
          Paste a list from Arena, Moxfield, MTGO or plain text ("4 Lightning Bolt"). Headers like Commander, Deck, Sideboard and Maybeboard become fences. It opens on a new
          table and is saved to your deck library.
        </p>
        <textarea
          aria-label="Deck list"
          className={styles.preview}
          placeholder={'Commander\n1 Atraxa, Praetors\' Voice\n\nDeck\n1 Sol Ring\n1 Command Tower\n…'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {missing.length > 0 && <textarea aria-label="Cards not found" className={styles.preview} style={{ minHeight: 60, height: 90 }} readOnly value={missing.join('\n')} />}
        <footer className={styles.footer}>
          <span className={styles.status} role="status">
            {status}
          </span>
          {missing.length > 0 ? (
            <button className={ui.primary} onClick={onClose}>
              Done
            </button>
          ) : (
            <button className={ui.primary} disabled={busy || !text.trim()} onClick={run}>
              {busy ? 'Importing…' : 'Import'}
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  );
}
