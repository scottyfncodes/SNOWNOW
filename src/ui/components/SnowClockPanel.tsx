import type { SnowClock } from '@/domain/plan';
import {
  formatClock,
  formatClockShort,
  formatDuration,
  formatWindowLabel,
  overlapMinutes,
  type MinuteOfDay,
} from '@/domain/time';
import { SnowClockChart } from './SnowClockChart';

const HEAT = (quality: number): string => {
  if (quality >= 88) return '🔥🔥';
  if (quality >= 80) return '🔥';
  if (quality >= 70) return '👌';
  if (quality >= 58) return '🙂';
  if (quality >= 45) return '😐';
  return '💤';
};

export interface SnowClockPanelProps {
  clock: SnowClock;
  firstTurn?: MinuteOfDay | null;
  leaveAt?: MinuteOfDay | null;
  now?: MinuteOfDay | null;
}

/**
 * The Snow Clock plus its hour-by-hour read-out — and, above all, a sentence.
 * A chart that needs to be studied has failed at 5am, so the headline finding
 * is written out in words and the picture backs it up.
 */
export function SnowClockPanel({ clock, firstTurn, leaveAt, now }: SnowClockPanelProps) {
  // Skip the dead hours before the lifts turn; one is enough for context.
  const hours = clock.points.filter(
    (point) => point.minute % 60 === 0 && point.minute >= clock.open - 60,
  );

  return (
    <section className="panel" aria-labelledby="snowclock-heading">
      <header className="panel-head">
        <h2 id="snowclock-heading" className="section-title">
          The Snow Clock
        </h2>
        {clock.prime && (
          <p className="panel-head-note">
            Prime <strong>{formatWindowLabel(clock.prime.start, clock.prime.end)}</strong>
          </p>
        )}
      </header>

      <p className="snowclock-caption">{captionFor(clock, firstTurn, leaveAt)}</p>

      <SnowClockChart clock={clock} firstTurn={firstTurn} leaveAt={leaveAt} now={now} />

      <ol className="hourstrip scroll-x" aria-label="Hour by hour">
        {hours.map((point) => (
          <li
            key={point.minute}
            className={`hourstrip-item${point.closed ? ' is-closed' : ''}${
              clock.prime && point.minute >= clock.prime.start && point.minute < clock.prime.end
                ? ' is-prime'
                : ''
            }`}
          >
            <span className="hourstrip-time numeral">{formatClockShort(point.minute)}</span>
            <span className="hourstrip-heat" aria-hidden="true">
              {point.closed ? '·' : HEAT(point.quality)}
            </span>
            <span className="hourstrip-label">{point.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The finding, in a sentence, before anyone has to read the picture. */
function captionFor(
  clock: SnowClock,
  firstTurn?: MinuteOfDay | null,
  leaveAt?: MinuteOfDay | null,
): string {
  const prime = clock.prime;
  if (!prime) return 'No standout window today — it holds up much the same from open to close.';

  const shape =
    prime.peakMinute <= clock.open + 150
      ? 'It is best early and gives ground through the afternoon'
      : prime.peakMinute >= clock.close - 180
        ? 'It gets better as the day goes on'
        : 'It peaks in the middle of the day';

  if (firstTurn == null || leaveAt == null) {
    return `${shape}. Best snow ${formatWindowLabel(prime.start, prime.end)}.`;
  }

  const caught = overlapMinutes(firstTurn, leaveAt, prime.start, prime.end);
  const length = prime.end - prime.start;
  const catchNote =
    caught >= length - 15
      ? `and your day covers all of it`
      : caught <= 0
        ? `and this plan misses it`
        : `and you catch ${formatDuration(caught)} of it`;

  return `${shape}. Best snow ${formatWindowLabel(prime.start, prime.end)} — you're on the hill from ${formatClock(firstTurn)}, ${catchNote}.`;
}
