// Tag Pane: a "#" tab in the top-right corner that expands into the tag tray.
// Tags are dragged onto cards; the board handles the drop. A second tab,
// Legality, checks the deck against every format without changing the
// table's own format (with none chosen, it offers to use a legal one).
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTable } from '../model/store';
import { tagCounts } from '../model/derived';
import { TAG_DRAG_TYPE } from '../board/dragTypes';
import { BUILT_IN_FORMATS, type Format } from '../rules/formats';
import { useFormats } from '../formats/formatsStore';
import { inLegalSets } from '../formats/setLegality';
import { formatFit } from '../rules/formatFit';
import ui from '../app/ui.module.css';
import styles from './TagPane.module.css';

export function TagPane() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [tab, setTab] = useState<'tags' | 'legality'>('tags');
  const tags = useTable((s) => s.tags);
  const counts = useTable(useShallow(tagCounts));
  const createTag = useTable((s) => s.createTag);

  if (!open) {
    return (
      <button aria-label="Open tags" className={styles.tab} onClick={() => setOpen(true)}>
        #
      </button>
    );
  }

  return (
    <section aria-label="Tags" className={styles.tray} data-wide={tab === 'legality' || undefined}>
      <div className={styles.header}>
        <span role="tablist" className={styles.tabs}>
          <button role="tab" aria-selected={tab === 'tags'} onClick={() => setTab('tags')}>
            Tags
          </button>
          <button role="tab" aria-selected={tab === 'legality'} onClick={() => setTab('legality')}>
            Legality
          </button>
        </span>
        <button aria-label="Close tags" className={ui.iconButton} onClick={() => setOpen(false)}>
          #
        </button>
      </div>
      {tab === 'legality' ? <LegalityList /> : <TagList tags={tags} counts={counts} draft={draft} setDraft={setDraft} createTag={createTag} />}
    </section>
  );
}

function TagList({
  tags,
  counts,
  draft,
  setDraft,
  createTag,
}: {
  tags: Record<string, { id: string; name: string }>;
  counts: Record<string, number>;
  draft: string;
  setDraft: (v: string) => void;
  createTag: (name: string) => string;
}) {
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const name = draft.trim();
          if (name && !Object.values(tags).some((t) => t.name.toLowerCase() === name.toLowerCase())) createTag(name);
          setDraft('');
        }}
      >
        <label>
          <span className={ui.visuallyHidden}>New tag</span>
          <input className={ui.input} style={{ width: '100%' }} placeholder="New tag, Enter" value={draft} onChange={(e) => setDraft(e.target.value)} />
        </label>
      </form>
      {Object.values(tags).map((t) => (
        <div key={t.id} className={styles.chip} draggable onDragStart={(e) => e.dataTransfer.setData(TAG_DRAG_TYPE, t.id)}>
          <span>{t.name}</span>
          <span className={styles.count}>{counts[t.id] ?? 0}</span>
        </div>
      ))}
    </>
  );
}

/** Every format, legal or not for the deck on the table, with the reasons. */
function LegalityList() {
  const cards = useTable((s) => s.cards);
  const fences = useTable((s) => s.fences);
  const current = useTable((s) => s.format);
  const custom = useFormats((s) => s.custom);
  const formats: Format[] = [...BUILT_IN_FORMATS.filter((f) => f.id !== 'none'), ...Object.values(custom)];
  const fits = useMemo(
    () => formats.map((f) => formatFit({ cards, fences }, f, (oracleId) => inLegalSets(f, oracleId))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cards, fences, custom],
  );
  if (!Object.keys(cards).length) return <p className={styles.note}>Put cards in a fence to check them against each format.</p>;
  return (
    <ul className={styles.legality}>
      {current === 'none' && <li className={styles.note}>No format chosen. Pick one that fits below?</li>}
      {fits.map(({ format, legal, reasons }) => (
        <li key={format.id} className={styles.fit} data-legal={legal || undefined} title={reasons.join('\n') || 'Legal'}>
          <span className={styles.mark}>{legal ? '✓' : '✕'}</span>
          <span className={styles.fitName}>
            {format.label}
            {format.id === current && <small> (this table)</small>}
            {!legal && <small className={styles.reason}>{reasons[0]}{reasons.length > 1 ? ` +${reasons.length - 1} more` : ''}</small>}
          </span>
          {current === 'none' && legal && (
            <button className={ui.button} onClick={() => useTable.getState().setFormat(format.id)}>
              Use
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
