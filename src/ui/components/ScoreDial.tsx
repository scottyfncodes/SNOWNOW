import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/ui/hooks/useReducedMotion';

export interface ScoreDialProps {
  score: number;
  size?: 'lg' | 'sm';
  label?: string;
}

/**
 * The number. It is the loudest thing on the screen on purpose — at 4:47am the
 * user wants one digit and a verb, and everything else is supporting evidence.
 */
export function ScoreDial({ score, size = 'lg', label }: ScoreDialProps) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? score : 0);

  useEffect(() => {
    if (reduced) {
      setShown(score);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const from = 0;
    const duration = 620;
    const tick = (time: number) => {
      const t = Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(from + (score - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score, reduced]);

  return (
    <div className={`scoredial scoredial-${size}`}>
      <span className="scoredial-value numeral" aria-hidden="true">
        {shown.toFixed(1)}
      </span>
      <span className="scoredial-scale" aria-hidden="true">
        / 10
      </span>
      <span className="visually-hidden">
        {label ?? 'Day score'} {score.toFixed(1)} out of 10
      </span>
    </div>
  );
}
