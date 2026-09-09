import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_PREFERENCES } from '@/config/weights';
import { resolveEnvironment } from '@/config/env';
import { findOrigin } from '@/data/origins';
import type { Origin } from '@/domain/mountain';
import { warmUpTrafficService } from '@/lib/warmup';
import { createProviderRegistry } from '@/providers';
import type { ProviderRegistry } from '@/providers/types';
import { useClock } from '@/ui/hooks/useClock';
import { MapScreen } from '@/ui/screens/MapScreen';

/**
 * SNOWNOW opens directly onto the Colorado map — the map *is* the homepage
 * and the mountain selector, not a companion screen reached from a NOW/LATER
 * choice. Tapping a mountain opens its profile in place; there is no separate
 * "primary navigation" for the user to get through first.
 *
 * The provider registry is created once and injected downward: the screen
 * knows it is talking to *a* weather/traffic/mountain provider, never which
 * one. Swapping the demo bundle for live integrations happens on this line
 * and nowhere else.
 */
export interface AppProps {
  /** Injectable so tests (and, later, a live bundle) can supply their own providers. */
  registry?: ProviderRegistry;
}

export default function App({ registry: injected }: AppProps = {}) {
  const registry = useMemo(() => injected ?? createProviderRegistry(), [injected]);
  const clock = useClock();
  const [origin, setOrigin] = useState<Origin>(() => findOrigin(DEFAULT_PREFERENCES.originId));

  // A cheap head start on the traffic backend's first request. See lib/warmup.ts.
  useEffect(() => {
    warmUpTrafficService(resolveEnvironment().trafficApiBaseUrl);
  }, []);

  const preferences = useMemo(
    () => ({ ...DEFAULT_PREFERENCES, originId: origin.id }),
    [origin.id],
  );

  return (
    <MapScreen
      registry={registry}
      clock={clock}
      origin={origin}
      onOriginChange={setOrigin}
      preferences={preferences}
      usingDemoData={registry.usingDemoData}
    />
  );
}
