import type { SnowClock } from '@/domain/plan';
import { formatClockShort, formatWindowLabel, type MinuteOfDay } from '@/domain/time';
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

/** The Snow Clock plus its hour-by-hour read-out. */
export function SnowClockPanel({ clock, firstTurn, leaveAt, now }: SnowClockPanelProps) {
  const hours = clock.points.filter((point) => point.minute % 60 === 0);

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
