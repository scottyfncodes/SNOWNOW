import { useMemo, useState } from 'react';
import { DEFAULT_PREFERENCES } from '@/config/weights';
import { createProviderRegistry } from '@/providers';
import type { ProviderRegistry } from '@/providers/types';
import { useClock } from '@/ui/hooks/useClock';
import { HomeScreen } from '@/ui/screens/HomeScreen';
import { LaterScreen } from '@/ui/screens/LaterScreen';
import { NowScreen } from '@/ui/screens/NowScreen';

type Mode = 'home' | 'now' | 'later';

/**
 * SNOWNOW.
 *
 * The provider registry is created once and injected downward: the screens
 * know they are talking to *a* weather/traffic/mountain provider, never which
 * one. Swapping the demo bundle for live integrations happens on this line and
 * nowhere else.
 */
export interface AppProps {
  /** Injectable so tests (and, later, a live bundle) can supply their own providers. */
  registry?: ProviderRegistry;
}

export default function App({ registry: injected }: AppProps = {}) {
  const registry = useMemo(() => injected ?? createProviderRegistry(), [injected]);
  const clock = useClock();
  const [mode, setMode] = useState<Mode>('home');
  const [originId, setOriginId] = useState(DEFAULT_PREFERENCES.originId);

  const preferences = useMemo(
    () => ({ ...DEFAULT_PREFERENCES, originId }),
    [originId],
  );

  if (mode === 'now') {
    return (
      <NowScreen
        registry={registry}
        clock={clock}
        preferences={preferences}
        onBack={() => setMode('home')}
      />
    );
  }

  if (mode === 'later') {
    return (
      <LaterScreen
        registry={registry}
        clock={clock}
        preferences={preferences}
        onBack={() => setMode('home')}
      />
    );
  }

  return (
    <HomeScreen
      originId={originId}
      onOriginChange={setOriginId}
      onNow={() => setMode('now')}
      onLater={() => setMode('later')}
      usingDemoData={registry.usingDemoData}
    />
  );
}
