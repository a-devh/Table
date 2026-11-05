// Shown after a fence is drawn: pick which deck section it holds. Drawn
// inside a fence open in the Custom view, it's a group in that fence instead:
// just give it a name.
import { useEffect, useState } from 'react';
import { useTable } from '../model/store';
import { useFenceUi } from './uiStore';
import { settleFences } from './actions';
import { useCurrentFormat } from '../formats/formatsStore';
import { zoneNames } from '../rules/formats';
import ui from '../app/ui.module.css';
import styles from './fences.module.css';

export function SectionPicker() {
  const pending = useFenceUi((s) => s.pending);
  const setPending = useFenceUi((s) => s.setPending);
  const fences = useTable((s) => s.fences);
  const [draft, setDraft] = useState('');
  const zones = zoneNames(useCurrentFormat());

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPending(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, setPending]);

  if (!pending) return null;

  // Drawn inside an open Custom-view fence: a group in it.
  const cx = pending.x + pending.width / 2;
  const cy = pending.y + pending.height / 2;
  const parent = Object.values(fences).find(
    (f) => !f.parentId && f.view === 'custom' && !f.stacked && cx >= f.x && cx <= f.x + f.width && cy >= f.y && cy <= f.y + f.height,
  );
  // A group's name is free text. Names already used for groups, and the
  // table's tags, are offered as shortcuts; picking a tag doesn't tie the
  // group to it.
  const groupNames = [...new Set(Object.values(fences).filter((f) => f.parentId).map((f) => f.name))];
  const tagNames = [...new Set(Object.values(useTable.getState().tags).map((t) => t.name))].filter((n) => !groupNames.includes(n));
  const groupCount = parent ? Object.values(fences).filter((f) => f.parentId === parent.id).length : 0;

  const custom = [...new Set(Object.values(fences).map((f) => f.section))].filter((s) => !zones.includes(s));

  const choose = (section: string) => {
    const t = useTable.getState();
    if (parent) t.drawFence(pending.x, pending.y, pending.width, pending.height, parent.section, section, parent.id);
    else t.drawFence(pending.x, pending.y, pending.width, pending.height, section, section);
    // Fit around the cards it was drawn over (one cell of padding).
    settleFences();
    // Back to Hand so cards can be dragged straight in.
    t.setTool('hand');
    setPending(null);
    setDraft('');
  };

  return (
    <>
      <div className={styles.scrim} onPointerDown={() => setPending(null)} />
      <div role="menu" aria-label="Choose a section" className={styles.picker} style={{ left: pending.screenX, top: pending.screenY }}>
        <div className={styles.pickerTitle}>{parent ? `Group in ${parent.name}` : 'Section'}</div>
        {(parent ? groupNames : [...zones, ...custom]).map((s) => (
          <button key={s} role="menuitem" className={styles.pickerItem} onClick={() => choose(s)}>
            {s}
          </button>
        ))}
        {parent && tagNames.length > 0 && (
          <>
            <div className={styles.pickerTitle}>Name after a tag</div>
            {tagNames.map((s) => (
              <button key={s} role="menuitem" className={styles.pickerItem} onClick={() => choose(s)}>
                # {s}
              </button>
            ))}
          </>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) choose(draft.trim());
            // A group doesn't need a name: Enter on an empty box makes "Group 2" etc.
            else if (parent) choose(`Group ${groupCount + 1}`);
          }}
        >
          <label>
            <span className={ui.visuallyHidden}>{parent ? 'Group name' : 'New section'}</span>
            <input
              autoFocus={!!parent}
              className={ui.input}
              style={{ width: '100%' }}
              placeholder={parent ? 'Name (optional), Enter' : '+ New section, Enter'}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
        </form>
      </div>
    </>
  );
}
