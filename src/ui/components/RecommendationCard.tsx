import type { SkiDayPlan } from '@/domain/plan';
import { formatClock, formatDuration, formatWindowLabel } from '@/domain/time';
import { ConfidencePill, DataBadge } from './DataBadge';
import { ScoreDial } from './ScoreDial';

export interface RecommendationCardProps {
  plan: SkiDayPlan;
  /** LATER shows a projection rather than a call. */
  projected?: boolean;
}

/**
 * The answer. Where, how good, when to leave, when it's best, when to bail —
 * in that order, before any evidence.
 */
export function RecommendationCard({ plan, projected = false }: RecommendationCardProps) {
  const { departure, snowClock } = plan;
  const ret = plan.return;

  return (
    <section className="reccard" aria-labelledby="reccard-name">
      <div className="reccard-top">
        <div className="reccard-identity">
          <p className="eyebrow">{projected ? 'Projected best' : 'The call'}</p>
          <h1 id="reccard-name" className="reccard-name">
            {plan.mountain.shortName}
          </h1>
          <p className="reccard-region">
            {plan.mountain.name} · {plan.mountain.state}
          </p>
        </div>
        <ScoreDial score={plan.score.score} label={`${plan.mountain.name} day score`} />
      </div>

      <p className="reccard-verdict">{projected ? plan.headline : plan.verdict}</p>
      {!projected && <p className="reccard-headline">{plan.headline}</p>}

      <div className="reccard-badges">
        <DataBadge provenance={plan.provenance} />
        <ConfidencePill level={plan.score.confidence} />
      </div>

      {departure && ret ? (
        <dl className="reccard-times">
          <div className="reccard-time">
            <dt>Leave {plan.origin.shortName}</dt>
            <dd className="numeral">{formatClock(departure.departure)}</dd>
            <p className="faint">{formatDuration(departure.driveMinutes)} drive</p>
          </div>
          <div className="reccard-time">
            <dt>Arrive</dt>
            <dd className="numeral">{formatClock(departure.arrival)}</dd>
            <p className="faint">First turn {formatClock(departure.firstTurn)}</p>
          </div>
          <div className="reccard-time is-prime is-wide">
            <dt>Prime snow</dt>
            <dd className="numeral">
              {snowClock.prime ? formatWindowLabel(snowClock.prime.start, snowClock.prime.end) : '—'}
            </dd>
            <p className="faint">
              {departure.primeCaptured > 0
                ? `${formatDuration(departure.primeCaptured)} of it is yours`
                : 'You miss it at this departure'}
            </p>
          </div>
          <div className="reccard-time">
            <dt>Head home</dt>
            <dd className="numeral">{formatClock(ret.departure)}</dd>
            <p className="faint">{formatDuration(ret.mountainMinutes)} on the hill</p>
          </div>
          <div className="reccard-time">
            <dt>Home by</dt>
            <dd className="numeral">{formatClock(ret.homeArrival)}</dd>
            <p className="faint">{formatDuration(ret.driveMinutes)} back</p>
          </div>
        </dl>
      ) : (
        <p className="reccard-notiming">
          We can't time this day — see the notes below.
        </p>
      )}

      <ul className="reccard-reasons">
        {plan.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </section>
  );
}
