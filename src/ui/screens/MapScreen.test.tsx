import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MOUNTAINS } from '@/data/mountains';
import { findOrigin, gpsOrigin } from '@/data/origins';
import { at } from '@/domain/time';
import { toDateKey } from '@/domain/dates';
import { createDemoRegistry } from '@/providers/demo';
import type { ProviderRegistry } from '@/providers/types';
import { unavailable } from '@/domain/provenance';
import { MapScreen } from './MapScreen';

const user = () => userEvent.setup();
const clock = { today: toDateKey(new Date('2026-01-17')), now: at(7, 0) };

describe('MapScreen', () => {
  it('shows every supported mountain as a selectable marker', () => {
    render(
      <MapScreen registry={createDemoRegistry()} clock={clock} origin={findOrigin('denver')} onBack={() => {}} />,
    );
    for (const mountain of MOUNTAINS) {
      expect(screen.getByRole('button', { name: new RegExp(`select ${mountain.name}`, 'i') })).toBeInTheDocument();
    }
  });

  it('resolves a route, shows drive time and distance, and opens the profile when a mountain is selected', async () => {
    render(
      <MapScreen registry={createDemoRegistry()} clock={clock} origin={findOrigin('denver')} onBack={() => {}} />,
    );
    const vail = MOUNTAINS.find((m) => m.id === 'vail')!;
    await user().click(screen.getByRole('button', { name: new RegExp(`select ${vail.name}`, 'i') }));

    await waitFor(() => expect(screen.getByText('Drive time')).toBeInTheDocument());
    expect(screen.getByText('Distance')).toBeInTheDocument();
    // Demo data is honestly labelled as a demo estimate, never claimed traffic-aware.
    expect(screen.getByText('Demo estimate')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: vail.name })).toBeInTheDocument();
    expect(screen.getByText('Official site ↗')).toBeInTheDocument();
  });

  it('works the same way for a GPS origin as for a manual city', async () => {
    const origin = gpsOrigin(39.7, -105.2);
    render(<MapScreen registry={createDemoRegistry()} clock={clock} origin={origin} onBack={() => {}} />);
    const breck = MOUNTAINS.find((m) => m.id === 'breckenridge')!;
    await user().click(screen.getByRole('button', { name: new RegExp(`select ${breck.name}`, 'i') }));
    await waitFor(() => expect(screen.getByText('Drive time')).toBeInTheDocument());
    expect(screen.getAllByText(/your location/i).length).toBeGreaterThan(0);
  });

  it('never fabricates a time or distance when routing fails — it says so honestly', async () => {
    const failingRegistry: ProviderRegistry = {
      ...createDemoRegistry(),
      traffic: {
        id: 'failing-traffic',
        getTravelCurve: async () => unavailable('failing-traffic', 'Simulated routing outage.'),
      },
    };

    render(<MapScreen registry={failingRegistry} clock={clock} origin={findOrigin('denver')} onBack={() => {}} />);
    const keystone = MOUNTAINS.find((m) => m.id === 'keystone')!;
    await user().click(screen.getByRole('button', { name: new RegExp(`select ${keystone.name}`, 'i') }));

    await waitFor(() => expect(screen.getByText(/Couldn't get a route/i)).toBeInTheDocument());
    expect(screen.getByText(/Simulated routing outage/i)).toBeInTheDocument();
    expect(screen.queryByText('Drive time')).not.toBeInTheDocument();
  });
});
