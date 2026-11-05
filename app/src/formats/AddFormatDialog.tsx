// Add Format / Edit format: opened from the format dropdown. Name, zones with
// counts, max copies, legal or illegal sets, and banned cards. Editing a custom
// format keeps its id, so tables that use it pick up the changes.
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { listSets, type SetInfo } from '../search/scryfall';
import { BASE_FORMATS, BUILT_IN_FORMATS, type Format, type Zone } from '../rules/formats';
import { useFormats } from './formatsStore';
import { SetChecklist } from './SetChecklist';
import { CardPicker } from './CardPicker';
import ui from '../app/ui.module.css';
import styles from './formats.module.css';

const slug = (name: string) =>
  'custom-' +
  (name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'format');

export function AddFormatDialog({
  editing,
  onClose,
  onSaved,
  onDeleted,
}: {
  /** A custom format to edit; without it the dialog adds a new one. */
  editing?: Format;
  onClose: () => void;
  onSaved: (id: string) => void;
  onDeleted?: (id: string) => void;
}) {
  const custom = useFormats((s) => s.custom);
  const [name, setName] = useState(editing?.label ?? '');
  const [zones, setZones] = useState<Zone[]>(
    editing?.zones.map((z) => ({ ...z })) ?? [
      { name: 'Main', count: 60 },
      { name: 'Sideboard', count: 15 },
    ],
  );
  const [maxCopies, setMaxCopies] = useState(editing?.maxCopies ?? 4);
  const [base, setBase] = useState(editing?.legality ?? '');
  const [setMode, setSetMode] = useState<'legal' | 'illegal'>(editing?.sets?.mode ?? 'legal');
  const [setCodes, setSetCodes] = useState<string[]>(editing?.sets?.codes ?? []);
  const [banned, setBanned] = useState<string[]>(editing?.banned ?? []);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const title = editing ? 'Edit format' : 'Add format';
  const [sets, setSets] = useState<SetInfo[]>([]);

  useEffect(() => {
    listSets()
      .then(setSets)
      .catch(() => setSets([]));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const trimmed = name.trim();
  const taken =
    BUILT_IN_FORMATS.some((f) => f.label.toLowerCase() === trimmed.toLowerCase()) ||
    Object.values(custom).some((f) => f.id !== editing?.id && f.label.toLowerCase() === trimmed.toLowerCase());
  const zonesOk = zones.length > 0 && zones.every((z) => z.name.trim() && z.count >= 0);
  const problem = !trimmed ? 'Give the format a name.' : taken ? 'A format with that name already exists.' : !zonesOk ? 'Every zone needs a name.' : '';

  const toggleBanned = (card: string) =>
    setBanned((bs) => (bs.some((b) => b.toLowerCase() === card.toLowerCase()) ? bs.filter((b) => b.toLowerCase() !== card.toLowerCase()) : [...bs, card]));

  const save = () => {
    if (problem) return;
    let id = editing?.id ?? slug(trimmed);
    while (!editing && custom[id]) id += '-2';
    const format: Format = {
      id,
      label: trimmed,
      zones: zones.map((z) => ({ name: z.name.trim(), count: z.count })),
      maxCopies,
      sets: { mode: setMode, codes: setCodes },
      banned,
      legality: base || undefined,
      custom: true,
    };
    useFormats.getState().saveFormat(format);
    onSaved(id);
  };

  /** Starting from a built-in format also takes its zones and copy limit. */
  const pickBase = (key: string) => {
    setBase(key);
    const built = BUILT_IN_FORMATS.find((f) => f.legality === key);
    if (built) {
      setZones(built.zones.map((z) => ({ ...z })));
      setMaxCopies(built.maxCopies);
    }
  };

  const updateZone = (i: number, patch: Partial<Zone>) => setZones((zs) => zs.map((z, j) => (j === i ? { ...z, ...patch } : z)));

  return createPortal(
    <div className={ui.scrim} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        role="dialog"
        aria-label={title}
        className={ui.dialog}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <header className={ui.dialogHeader}>
          <h2>{title}</h2>
          <button type="button" aria-label={`Close ${title.toLowerCase()}`} className={ui.iconButton} onClick={onClose}>
            ×
          </button>
        </header>

        <label className={styles.field}>
          <span>Name</span>
          <input autoFocus className={ui.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kitchen table" />
        </label>

        <label className={styles.field}>
          <span>Start from</span>
          <select aria-label="Base format" className={ui.button} value={base} onChange={(e) => pickBase(e.target.value)}>
            <option value="">Nothing (only the sets below)</option>
            {BASE_FORMATS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label} legality
              </option>
            ))}
          </select>
          <small className={styles.help}>Cards legal in this format are legal in yours. The sets below add to it or take away from it.</small>
        </label>

        <div className={styles.field}>
          <span>Zones</span>
          <div className={styles.zones}>
            {zones.map((z, i) => (
              <div key={i} className={styles.zoneRow}>
                <input aria-label={`Zone ${i + 1} name`} className={ui.input} value={z.name} onChange={(e) => updateZone(i, { name: e.target.value })} />
                <input
                  aria-label={`${z.name || `Zone ${i + 1}`} count`}
                  className={ui.input}
                  type="number"
                  min={0}
                  value={z.count}
                  onChange={(e) => updateZone(i, { count: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                />
                <button
                  type="button"
                  aria-label={`Remove ${z.name || 'zone'}`}
                  className={ui.iconButton}
                  disabled={zones.length === 1}
                  onClick={() => setZones((zs) => zs.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" className={styles.addZone} onClick={() => setZones((zs) => [...zs, { name: '', count: 1 }])}>
              + Add zone
            </button>
          </div>
          <small className={styles.help}>The first zone is the library the mana math uses. Maybeboard is always available.</small>
        </div>

        <label className={styles.field}>
          <span>Max copies</span>
          <span className={styles.inline}>
            <input
              className={ui.input}
              style={{ width: 72 }}
              type="number"
              min={1}
              value={maxCopies}
              onChange={(e) => setMaxCopies(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            />
            <small className={styles.help}>{maxCopies === 1 ? 'Singleton.' : `Up to ${maxCopies} of each card.`} Basic lands are exempt.</small>
          </span>
        </label>

        <div className={styles.field}>
          <span>Sets</span>
          <SetChecklist sets={sets} selected={setCodes} onChange={setSetCodes}>
            <select aria-label="Set rule" className={ui.button} value={setMode} onChange={(e) => setSetMode(e.target.value as 'legal' | 'illegal')}>
              <option value="legal">Also legal</option>
              <option value="illegal">Not legal</option>
            </select>
          </SetChecklist>
          <small className={styles.help}>
            {setMode === 'legal'
              ? setCodes.length
                ? `Cards printed in these sets are legal${base ? ' too' : ''}.`
                : base
                  ? 'Add sets whose cards should also be legal.'
                  : 'Pick a format to start from, or the sets that are legal.'
              : setCodes.length
                ? 'Cards only printed in these sets are not legal.'
                : 'Add sets whose cards should not be legal.'}
          </small>
        </div>

        <div className={styles.field}>
          <span>Banned cards</span>
          <CardPicker label="Ban a card" picked={banned} onToggle={toggleBanned} />
          <Chips items={banned} label={(b) => b} onRemove={toggleBanned} />
        </div>

        <footer className={styles.footer}>
          {editing && (
            <button
              type="button"
              className={ui.button}
              style={{ marginRight: 'auto', color: confirmDelete ? 'var(--danger, #e5484d)' : undefined }}
              onClick={() => {
                if (!confirmDelete) return setConfirmDelete(true);
                useFormats.getState().deleteFormat(editing.id);
                onDeleted?.(editing.id);
              }}
            >
              {confirmDelete ? 'Click again to delete' : 'Delete format'}
            </button>
          )}
          {problem && trimmed && <span className={styles.problem}>{problem}</span>}
          <button type="button" className={ui.button} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={ui.primary} disabled={!!problem}>
            {editing ? 'Save changes' : 'Add format'}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}

function Chips({ items, label, onRemove }: { items: string[]; label: (item: string) => string; onRemove: (item: string) => void }) {
  if (!items.length) return null;
  return (
    <div className={styles.chips}>
      {items.map((item) => (
        <span key={item} className={styles.chip}>
          {label(item)}
          <button type="button" aria-label={`Remove ${label(item)}`} onClick={() => onRemove(item)}>
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
