import { useId } from 'react';
import type { SnowClock } from '@/domain/plan';
import { formatClock, formatClockShort, type MinuteOfDay } from '@/domain/time';
import { linearScale, smoothPath } from './chart';

const WIDTH = 720;
const HEIGHT = 210;
const PAD = { top: 16, right: 14, bottom: 26, left: 14 };

export interface SnowClockChartProps {
  clock: SnowClock;
  /** Where the rider actually clicks in. */
  firstTurn?: MinuteOfDay | null;
  /** When they head for the car. */
  leaveAt?: MinuteOfDay | null;
  /** "Right now" marker, only meaningful for today. */
  now?: MinuteOfDay | null;
}

/**
 * The Snow Clock: the whole day at a glance.
 *
 * Deliberately not a meteogram. One curve — how good is it, right then — with
 * the moments that matter marked on top of it. The underlying numbers are
 * exposed to assistive technology as a table rather than being lost in the SVG.
 */
export function SnowClockChart({ clock, firstTurn, leaveAt, now }: SnowClockChartProps) {
  const gradientId = useId();
  const primeId = useId();
  const points = clock.points;
  if (points.length === 0) return null;

  const start = points[0]!.minute;
  const end = points[points.length - 1]!.minute + clock.stepMinutes;
  const x = linearScale([start, end], [PAD.left, WIDTH - PAD.right]);
  const y = linearScale([0, 100], [HEIGHT - PAD.bottom, PAD.top]);

  const curve = points.map((point) => ({ x: x(point.minute), y: y(point.quality) }));
  const line = smoothPath(curve);
  const area = `${line} L${x(end)},${y(0)} L${x(start)},${y(0)} Z`;

  const prime = clock.prime;
  const hourMarks: MinuteOfDay[] = [];
  for (let minute = Math.ceil(start / 60) * 60; minute <= end; minute += 120) hourMarks.push(minute);

  const summary = prime
    ? `Ski quality through the day. Best window ${formatClock(prime.start)} to ${formatClock(prime.end)}, peaking around ${formatClock(prime.peakMinute)}.`
    : 'Ski quality through the day.';

  return (
    <figure className="snowclock">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="snowclock-svg"
        role="img"
        aria-label={summary}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ice)" stopOpacity="0.5" />
            <stop offset="70%" stopColor="var(--ice)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--ice)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={primeId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[25, 50, 75].map((value) => (
          <line
            key={value}
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={y(value)}
            y2={y(value)}
            className="snowclock-grid"
          />
        ))}

        {prime && (
          <rect
            x={x(prime.start)}
            width={Math.max(2, x(prime.end) - x(prime.start))}
            y={PAD.top - 6}
            height={HEIGHT - PAD.bottom - PAD.top + 6}
            fill={`url(#${primeId})`}
            className="snowclock-prime"
          />
        )}

        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} className="snowclock-line" />

        {/* Closed hours are dimmed rather than cut off: the snow is still doing
            something before first chair, you just can't ski it yet. */}
        <rect
          x={PAD.left}
          width={Math.max(0, x(clock.open) - PAD.left)}
          y={PAD.top - 6}
          height={HEIGHT - PAD.bottom - PAD.top + 6}
          className="snowclock-closed"
        />

        <Marker x={x(clock.open)} label="OPEN" />
        {firstTurn != null && <Marker x={x(firstTurn)} label="YOU" accent />}
        {leaveAt != null && leaveAt <= end && <Marker x={x(leaveAt)} label="GO" accent />}
        {now != null && now >= start && now <= end && <Marker x={x(now)} label="NOW" pulse />}

        {hourMarks.map((minute) => (
          <text key={minute} x={x(minute)} y={HEIGHT - 8} className="snowclock-tick" textAnchor="middle">
            {formatClockShort(minute)}
          </text>
        ))}
      </svg>

      <figcaption className="visually-hidden">
        <table>
          <caption>Projected ski quality by time of day, 0 to 100</caption>
          <tbody>
            {points
              .filter((_, index) => index % 4 === 0)
              .map((point) => (
                <tr key={point.minute}>
                  <th scope="row">{formatClock(point.minute)}</th>
                  <td>
                    {Math.round(point.quality)} — {point.label}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}

function Marker({
  x,
  label,
  accent,
  pulse,
}: {
  x: number;
  label: string;
  accent?: boolean;
  pulse?: boolean;
}) {
  const className = ['snowclock-marker', accent && 'is-accent', pulse && 'is-now']
    .filter(Boolean)
    .join(' ');
  return (
    <g className={className}>
      <line x1={x} x2={x} y1={PAD.top - 6} y2={HEIGHT - PAD.bottom} />
      <text x={x} y={PAD.top - 9} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}
