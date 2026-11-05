// A fence's analytics, attached to its right edge on the table. It moves and
// zooms with the fence and draws above cards.
import { useTable } from '../model/store';
import { cardsInFence, mergeCount } from '../model/derived';
import type { Fence } from '../model/types';
import {
  MANA_COLORS, cmcCurve, identityCounts, manaSources, pipCounts, typeCounts, type Bar,
} from '../rules/analytics';
import { deckSize } from '../rules/formats';
import { useCurrentFormat } from '../formats/formatsStore';
import { useDeckCheck } from '../formats/deckCheckStore';
import { useSettings } from '../settings/settingsStore';
import { ManaSymbol } from '../app/ManaSymbol';
import { ANALYTICS_SECTIONS, useFenceUi, type AnalyticsSection } from './uiStore';

import styles from './analytics.module.css';

/** Panel size in table units per CSS pixel: readable next to full-size cards. */
const PANEL_SCALE = 2;

interface Props {
  fence: Fence;
  section: AnalyticsSection;
  onHover: (hovered: boolean) => void;
}

export function AnalyticsPanel({ fence, section, onHover }: Props) {
  const zoom = useTable((s) => s.camera.zoom);
  // Recomputed only when the cards or fences change, not on camera moves.
  const cards = useTable((s) => s.cards);
  const fences = useTable((s) => s.fences);
  const members = cardsInFence({ ...useTable.getState(), cards, fences }, fence.id);
  const closeAnalytics = useFenceUi((s) => s.closeAnalytics);
  const openAnalytics = useFenceUi((s) => s.openAnalytics);
  const setPinned = useTable((s) => s.setAnalyticsPinned);

  const count = members.reduce((n, c) => n + mergeCount(c), 0);
  const show = (s: AnalyticsSection) => section === 'all' || section === s;
  const curve = cmcCurve(members);
  const pips = pipCounts(members);
  const pipTotal = MANA_COLORS.reduce((n, c) => n + pips[c], 0);
  const identity = identityCounts(members);
  const rules = useCurrentFormat();
  const check = useDeckCheck();
  const zone = check.zones.find((z) => z.zone === fence.section);
  // One line per card name (copies of the same card share their problems).
  const problemCards = [
    ...new Map(
      members.filter((c) => check.cardIssues[c.id]).map((c) => [c.copies[0].data.name, check.cardIssues[c.id].map((i) => i.text).join('; ')]),
    ),
  ];
  const math = useSettings((s) => s.manaMath);
  const sources = manaSources(members, deckSize(rules), math);

  return (
    <aside
      aria-label={`${fence.name} analytics`}
      className={styles.panel}
      style={{
        // Inside the fence overlay's camera layer, which already follows the pan.
        left: (fence.x + fence.width + 12 * PANEL_SCALE) * zoom,
        top: fence.y * zoom,
        // Drawn at card scale so it keeps its size relative to the fence and cards.
        transform: `scale(${zoom * PANEL_SCALE})`,
        maxHeight: Math.max(fence.height / PANEL_SCALE, 240),
      }}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      onWheel={(e) => e.stopPropagation()}
    >
      <header className={styles.top}>
        <select
          aria-label="Analytics section"
          className={styles.select}
          value={section}
          onChange={(e) => openAnalytics(fence.id, e.target.value as AnalyticsSection)}
        >
          {ANALYTICS_SECTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          className={styles.iconButton}
          aria-pressed={fence.analyticsPinned}
          title={fence.analyticsPinned ? 'Unpin' : 'Pin open'}
          onClick={() => setPinned(fence.id, !fence.analyticsPinned)}
        >
          {fence.analyticsPinned ? 'Pinned' : 'Pin'}
        </button>
        <button
          className={styles.iconButton}
          aria-label="Close analytics"
          onClick={() => {
            setPinned(fence.id, false);
            closeAnalytics(fence.id);
          }}
        >
          ×
        </button>
      </header>

      {show('legality') && (
        <section className={styles.block}>
          <h3>
            Legality <span className={styles.aside}>{rules.label}</span>
          </h3>
          {rules.id === 'none' ? (
            <p className={styles.note}>Pick a format to check legality.</p>
          ) : !zone ? (
            <p className={styles.note}>{fence.section} isn't a {rules.label} zone, so it isn't checked.</p>
          ) : (
            <>
              <p className={styles.note} data-bad={!zone.ok || undefined}>
                {fence.section}: {zone.count} cards, needs {zone.rule} {zone.target}.
              </p>
              {problemCards.length === 0 ? (
                <p className={styles.note}>No card problems.</p>
              ) : (
                <ul className={styles.issues}>
                  {problemCards.map(([name, text]) => (
                    <li key={name}>
                      <strong>{name}</strong> {text}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}

      {count === 0 && <p className={styles.note}>Drop cards in this fence to see its analytics.</p>}

      {count > 0 && show('cmc') && (
        <section className={styles.block}>
          <h3>
            CMC <span className={styles.aside}>avg {curve.average.toFixed(2)}, lands left out{curve.bars.some((b) => b.potential) ? ', striped = X spells' : ''}</span>
          </h3>
          <Columns bars={curve.bars} />
        </section>
      )}

      {count > 0 && show('types') && (
        <section className={styles.block}>
          <h3>Types</h3>
          <Rows bars={typeCounts(members)} />
        </section>
      )}

      {count > 0 && show('pips') && (
        <section className={styles.block}>
          <h3>Pips</h3>
          {pipTotal === 0 ? (
            <p className={styles.note}>No colored pips.</p>
          ) : (
            <Rows
              bars={MANA_COLORS.filter((c) => pips[c] > 0).map((c) => ({ label: c, value: pips[c] }))}
              symbols
              percentOf={pipTotal}
            />
          )}
        </section>
      )}

      {count > 0 && show('identity') && (
        <section className={styles.block}>
          <h3>Color Identity</h3>
          <Rows bars={(['W', 'U', 'B', 'R', 'G', 'C'] as const).filter((c) => identity[c] > 0).map((c) => ({ label: c, value: identity[c] }))} symbols />
        </section>
      )}

      {count > 0 && show('sources') && (
        <section className={styles.block}>
          <h3>
            Mana sources{' '}
            <span className={styles.aside}>
              {deckSize(rules)}-card library, {rules.label}
            </span>
          </h3>
          {sources.length === 0 ? (
            <p className={styles.note}>No colored spells.</p>
          ) : (
            <table className={styles.sources}>
              <thead>
                <tr>
                  <th />
                  <th>Sources</th>
                  <th>Need</th>
                  <th>Hardest card</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.color}>
                    <td>
                      <ManaSymbol color={s.color} />
                    </td>
                    <td className={s.have < s.need ? styles.short : undefined}>
                      {s.have}
                      {s.have < s.need && <span className={styles.shortMark}> (−{s.need - s.have})</span>}
                    </td>
                    <td>{s.need}</td>
                    <td className={styles.hardest} title={s.hardest}>
                      {s.hardest}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className={styles.note}>
            Sources needed to cast each color's hardest spell on curve {Math.round(math.castChance * 100)}% of the time,{' '}
            {math.onTheDraw ? 'on the draw' : 'on the play'} (Frank Karsten's method). A dual or triome counts for each color it makes. Change the math in Settings.
          </p>
        </section>
      )}

    </aside>
  );
}

/** Vertical bars, one per bucket, value on top. */
function Columns({ bars }: { bars: Bar[] }) {
  const max = Math.max(1, ...bars.map((b) => b.value + (b.potential ?? 0)));
  return (
    <div className={styles.columns}>
      {bars.map((b) => (
        <div
          key={b.label}
          className={styles.column}
          title={`CMC ${b.label}: ${b.value}${b.potential ? ` (+${b.potential} X spell${b.potential > 1 ? 's' : ''} castable for ${b.label})` : ''}`}
        >
          <span className={styles.value}>
            {b.value || ''}
            {b.potential ? <small className={styles.potential}>+{b.potential}</small> : null}
          </span>
          <span className={styles.track}>
            <span className={styles.stack}>
              {b.potential ? <span className={styles.barPotential} style={{ height: `${(b.potential / max) * 100}%` }} /> : null}
              <span className={styles.barV} style={{ height: `${(b.value / max) * 100}%` }} />
            </span>
          </span>
          <span className={styles.label}>{b.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Horizontal bars with a label (or mana symbol) and value. */
function Rows({ bars, symbols, percentOf }: { bars: Bar[]; symbols?: boolean; percentOf?: number }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className={styles.rows}>
      {bars.map((b) => (
        <div key={b.label} className={styles.row}>
          <span className={styles.rowLabel}>{symbols ? <ManaSymbol color={b.label} /> : b.label}</span>
          <span className={styles.rowTrack}>
            <span className={styles.barH} style={{ width: `${(b.value / max) * 100}%` }} />
          </span>
          <span className={styles.rowValue}>
            {Number.isInteger(b.value) ? b.value : b.value.toFixed(1)}
            {percentOf ? <span className={styles.aside}> {Math.round((b.value / percentOf) * 100)}%</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}
