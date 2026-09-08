import type { SkiDayPlan } from '@/domain/plan';
import type { MountainProfile as MountainReference } from '@/domain/mountainProfile';
import { ConditionsPanel } from './ConditionsPanel';
import { DataBadge } from './DataBadge';
import { GetTherePanel } from './GetTherePanel';
import { MountainProfilePanel } from './MountainProfilePanel';
import { ParkingPanel } from './ParkingPanel';
import { ScoreDial } from './ScoreDial';
import { SnowClockPanel } from './SnowClockPanel';

export interface MountainProfileProps {
  plan: SkiDayPlan;
  reference: MountainReference | null;
  now?: number | null;
}

/**
 * The whole "what should I do about this mountain" answer, in the order the
 * product brief specifies: verdict, conditions, parking, route, timing, why,
 * then the reference material nobody needs at a glance. Every section reads
 * from the same `SkiDayPlan` the NOW/LATER screens already compute — this is
 * not a second, map-only recommendation engine.
 */
export function MountainProfile({ plan, reference, now }: MountainProfileProps) {
  const offSeason = plan.offSeasonMessage;
  const allSourcesUnavailable =
    plan.dataSources.length > 0 && plan.dataSources.every((source) => source.status === 'unavailable');

  return (
    <div className="mountainprofile stack">
      <header className="mountainprofile-header">
        <div className="mountainprofile-identity">
          <h1 className="mountainprofile-name">{plan.mountain.name}</h1>
          <p className="mountainprofile-verdict" role={offSeason ? 'status' : undefined}>
            {offSeason ? offSeason.line : plan.verdict}
          </p>
          <DataBadge provenance={plan.provenance} allSourcesUnavailable={allSourcesUnavailable} />
        </div>
        {!offSeason && (
          <div className="mountainprofile-scorewrap">
            <ScoreDial score={plan.score.score} label={`${plan.mountain.name} day score`} />
          </div>
        )}
      </header>

      <p className="mountainprofile-headline">{offSeason ? offSeason.detail : plan.headline}</p>

      <ConditionsPanel plan={plan} />

      <ParkingPanel parking={plan.parking} />

      <GetTherePanel plan={plan} />

      {!offSeason && (
        <SnowClockPanel
          clock={plan.snowClock}
          snowState={plan.snowState}
          firstTurn={plan.departure?.firstTurn ?? null}
          leaveAt={plan.return?.departure ?? null}
          now={plan.isToday ? (now ?? null) : null}
        />
      )}

      {!offSeason && plan.reasons.length > 0 && (
        <section className="panel mountainprofile-why" aria-labelledby="why-heading">
          <h2 id="why-heading" className="section-title">
            Why {plan.mountain.shortName}
          </h2>
          <ul className="mountainprofile-reasons">
            {plan.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </section>
      )}

      <details className="mountainprofile-more">
        <summary>Other details</summary>
        <MountainProfilePanel mountain={plan.mountain} profile={reference} />
      </details>
    </div>
  );
}
