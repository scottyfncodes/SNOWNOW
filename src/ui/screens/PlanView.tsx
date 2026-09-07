import { useCallback, useRef, useState } from 'react';
import type { Recommendation, SkiDayPlan } from '@/domain/plan';
import type { MinuteOfDay } from '@/domain/time';
import { planSummary } from '@/engine/explain';
import { AlternativeList } from '@/ui/components/AlternativeList';
import { Caveats } from '@/ui/components/Caveats';
import { DepartureWhatIf } from '@/ui/components/DepartureWhatIf';
import { FactorBreakdown } from '@/ui/components/FactorBreakdown';
import { RecommendationCard } from '@/ui/components/RecommendationCard';
import { ReturnPlanner } from '@/ui/components/ReturnPlanner';
import { SnowClockPanel } from '@/ui/components/SnowClockPanel';
import { Timeline } from '@/ui/components/Timeline';

export interface PlanViewProps {
  recommendation: Recommendation;
  now?: MinuteOfDay | null;
  projected?: boolean;
}

/**
 * One full ski-day answer, whether it came from NOW or LATER. Both modes ask
 * the same question, so they get the same anatomy.
 */
export function PlanView({ recommendation, now, projected = false }: PlanViewProps) {
  const [selectedId, setSelectedId] = useState(recommendation.best.mountain.id);
  const [showFactors, setShowFactors] = useState(false);
  const alternativesRef = useRef<HTMLElement | null>(null);

  const scrollToAlternatives = useCallback(() => {
    const node = alternativesRef.current;
    if (!node) return;

    // Smooth scrolling is the nicety; moving focus is the part that matters,
    // because it is what makes the jump work for keyboard and screen-reader
    // users rather than only for people who can watch the page slide. So the
    // scroll is optional, and where it is unavailable focus does the scrolling
    // instead of being told to suppress it.
    const canScroll = typeof node.scrollIntoView === 'function';
    if (canScroll) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    node.focus({ preventScroll: canScroll });
  }, []);

  const plan: SkiDayPlan =
    recommendation.all.find((candidate) => candidate.mountain.id === selectedId) ??
    recommendation.best;
  const others = recommendation.all.filter((candidate) => candidate.mountain.id !== plan.mountain.id);

  return (
    <div className="planview stack">
      <p className="visually-hidden" role="status">
        {planSummary(plan)}
      </p>

      <RecommendationCard
        plan={plan}
        projected={projected}
        why={
          plan.mountain.id === recommendation.best.mountain.id
            ? recommendation.comparison
            : `${recommendation.best.mountain.shortName} is still the better overall day.`
        }
        onCompare={others.length > 0 ? scrollToAlternatives : undefined}
      />

      <SnowClockPanel
        clock={plan.snowClock}
        firstTurn={plan.departure?.firstTurn ?? null}
        leaveAt={plan.return?.departure ?? null}
        now={plan.isToday ? now : null}
      />

      <Timeline events={plan.timeline} />

      <DepartureWhatIf plan={plan} />

      <ReturnPlanner plan={plan} now={now} />

      <AlternativeList
        ref={alternativesRef}
        alternatives={others}
        comparison={
          plan.mountain.id === recommendation.best.mountain.id
            ? `Every mountain within reach, ranked. Tap one to see its whole day.`
            : `Showing ${plan.mountain.shortName}. ${recommendation.best.mountain.shortName} is still the better overall day.`
        }
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      <section className="panel">
        <button
          type="button"
          className="disclosure"
          onClick={() => setShowFactors((value) => !value)}
          aria-expanded={showFactors}
        >
          <span className="section-title">How we got {plan.score.score.toFixed(1)}</span>
          <span aria-hidden="true">{showFactors ? '−' : '+'}</span>
        </button>
        {showFactors && <FactorBreakdown score={plan.score} />}
      </section>

      <Caveats items={plan.caveats} />
    </div>
  );
}
