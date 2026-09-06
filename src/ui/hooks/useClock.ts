import { useEffect, useState } from 'react';
import { toDateKey, type DateKey } from '@/domain/dates';
import { at, type MinuteOfDay } from '@/domain/time';

export interface ClockState {
  today: DateKey;
  now: MinuteOfDay;
}

const read = (): ClockState => {
  const date = new Date();
  return { today: toDateKey(date), now: at(date.getHours(), date.getMinutes()) };
};

/**
 * NOW means today, and "today" has to keep meaning today if the app is left
 * open. Ticks once a minute; the recommendation itself is not recomputed on
 * every tick, only the "right now" markers that depend on it.
 */
export function useClock(): ClockState {
  const [state, setState] = useState<ClockState>(read);

  useEffect(() => {
    const id = window.setInterval(() => {
      setState((previous) => {
        const next = read();
        return next.now === previous.now && next.today === previous.today ? previous : next;
      });
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return state;
}
