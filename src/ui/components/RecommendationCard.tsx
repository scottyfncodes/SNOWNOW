import type { SkiDayPlan } from '@/domain/plan';
import { formatPrice, savingsVsWindow } from '@/domain/pricing';
import { formatClock, formatDuration, formatWindowLabel } from '@/domain/time';
import { ConfidencePill, DataBadge } from './DataBadge';
import { ScoreDial } from './ScoreDial';

export interface RecommendationCardProps {
  plan: SkiDayPlan;
  /** One line on why this mountain beat the runner-up. */
  why?: string;
  /** LATER shows a projection rather than a call. */
  projected?: boolean;
  onCompare?: () => void;
}

/**
 * Says out loud what the badges only imply. LATER is a projection, and the
 * further out it reaches the more it is leaning on pattern rather than on any
 * particular model run — so the card says so in words, every time.
 */
function projectionNote(
  horizonDays: number,
  confidence: 'high' | 'medium' | 'low',
): string {
  const when =
    horizonDays <= 1
      ? 'tomorrow'
      : `${horizonDays} days out`;
  if (confidence === 'high') {
    return `A projection for ${when}, not a promise. Close enough in that the forecast is doing most of the work.`;
  }
  if (confidence === 'medium') {
    return `A projection for ${when}, not a promise. Expect the snow totals to move before then.`;
  }
  return `A projection for ${when}, not a promise. This far out we are leaning on pattern and history more than on any single forecast — treat it as a shortlist, not a plan.`;
}

/**
 * The answer, in the order a half-awake skier asks for it:
 *
 *   where · how good · when to leave · when you're on snow · when to bail · why
 *
 * Everything on this card earns its place by answering one of those. The
 * verdict outranks the decimal — a number is only decision support, and
 * "LET'S RIDE." is the actual output of the product.
 */
export function RecommendationCard({ plan, why, projected = false, onCompare }: RecommendationCardProps) {
  const { departure, snowClock } = plan;
  const ret = plan.return;
  const ticket = plan.ticket;
  const allSourcesUnavailable =
    plan.dataSources.length > 0 && plan.dataSources.every((source) => source.status === 'unavailable');

  return (
    <section className="reccard" aria-labelledby="reccard-name">
      <div className="reccard-top">
        <div className="reccard-identity">
          {projected && <p className="eyebrow">Projected</p>}
          <h1 id="reccard-name" className="reccard-name">
            {plan.mountain.shortName}
          </h1>
          {/* "BECK" needs no gloss; "WP" does. Only spell it out when the
              short name isn't already the mountain's name. */}
          {plan.mountain.name.toUpperCase() !== plan.mountain.shortName.toUpperCase() && (
            <p className="reccard-fullname">
              {plan.mountain.name} · {plan.mountain.region}
            </p>
          )}
          <p className="reccard-verdict">{plan.verdict}</p>
        </div>
        <div className="reccard-scorewrap">
          <ScoreDial score={plan.score.score} label={`${plan.mountain.name} day score`} />
          <p className="reccard-scorelabel">Day score</p>
        </div>
      </div>

      <p className="reccard-headline">{plan.headline}</p>

      <div className="reccard-badges">
        <DataBadge provenance={plan.provenance} allSourcesUnavailable={allSourcesUnavailable} />
        <ConfidencePill level={plan.score.confidence} />
      </div>

      {projected && (
        <p className="reccard-projection">
          {projectionNote(plan.provenance.horizonDays, plan.score.confidence)}
        </p>
      )}

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
        <p className="reccard-notiming">We can't time this day — see the notes below.</p>
      )}

      {ticket ? (
        <p className="reccard-ticket">
          <span className="reccard-ticket-label">Lift ticket</span>
          <span className="reccard-ticket-price numeral">
            {formatPrice(ticket.adultDay, ticket.currency)}
          </span>
          <span className="reccard-ticket-note">
            {savingsVsWindow(ticket) > 8
              ? `${formatPrice(savingsVsWindow(ticket), ticket.currency)} under the window rate`
              : ticket.note}
          </span>
        </p>
      ) : (
        plan.ticketPurchaseUrl && (
          <p className="reccard-ticket">
            <span className="reccard-ticket-label">Lift ticket</span>
            <span className="reccard-ticket-note">
              Current price unavailable —{' '}
              <a href={plan.ticketPurchaseUrl} target="_blank" rel="noreferrer">
                buy at the resort
              </a>
            </span>
          </p>
        )
      )}

      <div className="reccard-why">
        <h2 className="eyebrow">Why {plan.mountain.shortName}</h2>
        {why && <p className="reccard-whyline">{why}</p>}
        <ul className="reccard-reasons">
          {plan.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        {onCompare && (
          <button type="button" className="linkbutton" onClick={onCompare}>
            Compare the alternatives ↓
          </button>
        )}
      </div>
    </section>
  );
}
