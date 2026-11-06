// The Decks panel: the deck library, each saved deck shown as a deckbox.
import { useState } from 'react';
import { useTable } from '../model/store';
import { isDirty, useFileState } from '../utility/fileState';
import { useDecks } from './decksStore';
import { deleteFromLibrary, openFromLibrary, saveToLibrary } from './library';
import { Deckbox } from './Deckbox';
import { menuGesture } from '../app/device';
import { ImportDialog } from '../utility/ImportDialog';
import ui from '../app/ui.module.css';
import panel from '../app/Modules.module.css';
import search from '../search/SearchModule.module.css';
import styles from './DecksModule.module.css';

export function DecksModule() {
  const decks = useDecks((s) => s.decks);
  const deckId = useFileState((f) => f.deckId);
  const saved = useFileState((f) => f.saved);
  const dirty = useTable((t) => isDirty(t, saved));
  const [filter, setFilter] = useState('');
  const [importing, setImporting] = useState(false);
  const current = deckId ? decks[deckId] : undefined;

  const needle = filter.trim().toLowerCase();
  const list = Object.values(decks)
    .filter((d) => !needle || d.name.toLowerCase().includes(needle))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <>
      <div className={search.header}>
        <h2 className={panel.title}>Decks</h2>
        {list.length > 0 && <span className={search.count}>{Object.keys(decks).length} decks</span>}
      </div>
      <div className={styles.actions}>
        {current ? (
          <>
            <button className={ui.primary} disabled={!dirty} title="Save the table over this deck (Ctrl+S)" onClick={() => saveToLibrary()}>
              {dirty ? 'Save changes' : 'Saved'}
            </button>
            <button className={ui.button} title="Save the table as another deck" onClick={() => saveToLibrary(true)}>
              Save as new
            </button>
          </>
        ) : (
          <button className={ui.primary} title="Keep the table's deck in the library" onClick={() => saveToLibrary(true)}>
            Save table to library
          </button>
        )}
      </div>
      <button className={ui.button} style={{ alignSelf: 'flex-start' }} onClick={() => setImporting(true)}>
        Import a deck list…
      </button>
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
      {Object.keys(decks).length > 3 && (
        <input className={ui.input} placeholder="Filter by name" aria-label="Filter decks" value={filter} onChange={(e) => setFilter(e.target.value)} />
      )}
      <div className={search.results}>
        {!list.length && (
          <p className={panel.placeholder}>
            {needle ? 'No decks match.' : 'No saved decks yet. Save the table to keep it here; click a deckbox to open it again.'}
          </p>
        )}
        <div className={styles.shelf}>
          {list.map((d) => (
            <Deckbox key={d.id} deck={d} open={d.id === deckId} onOpen={() => openFromLibrary(d.id)} onDelete={() => deleteFromLibrary(d.id)} />
          ))}
        </div>
        {list.length > 0 && <p className={styles.hint}>Drop a card here, or {menuGesture().toLowerCase()} it on the table, to make it the deck's cover.</p>}
      </div>
    </>
  );
}
