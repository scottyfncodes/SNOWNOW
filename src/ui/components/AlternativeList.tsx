import type { SkiDayPlan } from '@/domain/plan';
import { formatClock, formatDuration } from '@/domain/time';

export interface AlternativeListProps {
  alternatives: SkiDayPlan[];
  comparison: string;
  selectedId: string;
  onSelect: (mountainId: string) => void;
}

/**
 * Alternatives are shown as *trade-offs*, never as a table of metrics to
 * compare by hand. The point is to make the winner's win legible.
 */
export function AlternativeList({
  alternatives,
  comparison,
  selectedId,
  onSelect,
}: AlternativeListProps) {
  if (alternatives.length === 0) return null;

  return (
    <section className="panel" aria-labelledby="alts-heading">
      <header className="panel-head">
        <h2 id="alts-heading" className="section-title">
          Why that one
        </h2>
      </header>
      <p className="alts-comparison">{comparison}</p>

      <ul className="alts">
        {alternatives.map((plan) => (
          <li key={plan.mountain.id}>
            <button
              type="button"
              className={`alt${plan.mountain.id === selectedId ? ' is-selected' : ''}`}
              onClick={() => onSelect(plan.mountain.id)}
              aria-pressed={plan.mountain.id === selectedId}
            >
              <span className="alt-head">
                <span className="alt-name">{plan.mountain.shortName}</span>
                <span className="alt-score numeral">{plan.score.score.toFixed(1)}</span>
              </span>
              <span className="alt-meta">
                {plan.departure && plan.return ? (
                  <>
                    Leave {formatClock(plan.departure.departure)} ·{' '}
                    {formatDuration(plan.departure.driveMinutes)} up ·{' '}
                    {formatDuration(plan.return.mountainMinutes)} on snow
                  </>
                ) : (
                  <>Timing unavailable</>
                )}
              </span>
              <span className="alt-tradeoffs">
                {plan.tradeoffs.map((tradeoff) => (
                  <span key={tradeoff} className="alt-tradeoff">
                    {tradeoff}
                  </span>
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
