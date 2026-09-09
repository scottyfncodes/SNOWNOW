import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { findOrigin } from '@/data/origins';
import { OriginPicker } from './OriginPicker';

const user = () => userEvent.setup();

afterEach(() => {
  vi.unstubAllGlobals();
  // @ts-expect-error -- test cleanup of a jsdom global that has no type by default
  delete navigator.geolocation;
});

describe('OriginPicker — use my location', () => {
  it('routes from the exact GPS coordinate, never the nearest known city', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        // A real address in Lakewood, CO — not the center of any of the six
        // manual cities. If this ever gets snapped to "closest city" again,
        // onChange would be called with Denver's or Boulder's coordinates
        // instead of this exact point.
        coords: { latitude: 39.7047, longitude: -105.0814, accuracy: 12 },
      } as GeolocationPosition);
    });
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });

    const onChange = vi.fn();
    render(<OriginPicker origin={findOrigin('denver')} onChange={onChange} />);

    await user().click(screen.getByRole('button', { name: /use my current location/i }));

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    const passedOrigin = onChange.mock.calls[0]![0];
    expect(passedOrigin.coordinates).toEqual({ lat: 39.7047, lon: -105.0814 });
    expect(passedOrigin.id).not.toBe('denver');
    expect(passedOrigin.id).not.toBe('boulder');
  });

  it('shows a locating state while waiting on the browser', async () => {
    let resolvePosition: (position: GeolocationPosition) => void = () => {};
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      resolvePosition = success as (position: GeolocationPosition) => void;
    });
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });

    render(<OriginPicker origin={findOrigin('denver')} onChange={vi.fn()} />);
    const button = screen.getByRole('button', { name: /use my current location/i });
    await user().click(button);

    expect(screen.getByText(/finding your location/i)).toBeInTheDocument();
    expect(button).toBeDisabled();

    act(() => {
      resolvePosition({ coords: { latitude: 39.7, longitude: -105.1 } } as GeolocationPosition);
    });
    await waitFor(() => expect(screen.getByText(/using your current location/i)).toBeInTheDocument());
  });

  it('shows a plain-language message and never crashes when location access is denied', async () => {
    const getCurrentPosition = vi.fn(
      (_success: PositionCallback, error: PositionErrorCallback) => {
        error({ code: 1, PERMISSION_DENIED: 1, message: 'denied' } as GeolocationPositionError);
      },
    );
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });

    const onChange = vi.fn();
    render(<OriginPicker origin={findOrigin('denver')} onChange={onChange} />);

    await user().click(screen.getByRole('button', { name: /use my current location/i }));

    await waitFor(() =>
      expect(screen.getByText(/location access is off.*choose a starting city instead/i)).toBeInTheDocument(),
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('tells a denied user specifically how to re-enable location in Safari, not just "choose a city"', async () => {
    const getCurrentPosition = vi.fn(
      (_success: PositionCallback, error: PositionErrorCallback) => {
        error({ code: 1, PERMISSION_DENIED: 1, message: 'denied' } as GeolocationPositionError);
      },
    );
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });

    render(<OriginPicker origin={findOrigin('denver')} onChange={vi.fn()} />);
    await user().click(screen.getByRole('button', { name: /use my current location/i }));

    await waitFor(() => expect(screen.getByText(/settings.*safari.*location/i)).toBeInTheDocument());
  });

  it('gives a distinct, actionable message for POSITION_UNAVAILABLE rather than a generic failure', async () => {
    const getCurrentPosition = vi.fn(
      (_success: PositionCallback, error: PositionErrorCallback) => {
        error({ code: 2, POSITION_UNAVAILABLE: 2, message: 'unavailable' } as GeolocationPositionError);
      },
    );
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });

    render(<OriginPicker origin={findOrigin('denver')} onChange={vi.fn()} />);
    await user().click(screen.getByRole('button', { name: /use my current location/i }));

    await waitFor(() =>
      expect(screen.getByText(/couldn't get a location fix.*choose a starting city instead/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/^2$/)).not.toBeInTheDocument();
  });

  it('shows a plain-language message on timeout, not a raw error code', async () => {
    const getCurrentPosition = vi.fn(
      (_success: PositionCallback, error: PositionErrorCallback) => {
        error({ code: 3, TIMEOUT: 3, message: 'timeout' } as GeolocationPositionError);
      },
    );
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });

    render(<OriginPicker origin={findOrigin('denver')} onChange={vi.fn()} />);
    await user().click(screen.getByRole('button', { name: /use my current location/i }));

    await waitFor(() => expect(screen.getByText(/choose a starting city instead/i)).toBeInTheDocument());
    expect(screen.queryByText(/code/i)).not.toBeInTheDocument();
  });

  it("tells the user plainly when the browser can't share location at all, instead of failing silently", async () => {
    vi.stubGlobal('navigator', { ...navigator, geolocation: undefined });

    render(<OriginPicker origin={findOrigin('denver')} onChange={vi.fn()} />);
    await user().click(screen.getByRole('button', { name: /use my current location/i }));

    expect(screen.getByText(/can't share your location/i)).toBeInTheDocument();
  });

  it('still lets you pick a city from the dropdown directly', async () => {
    const onChange = vi.fn();
    render(<OriginPicker origin={findOrigin('denver')} onChange={onChange} />);
    await user().selectOptions(screen.getByLabelText(/starting from/i), 'durango');
    expect(onChange).toHaveBeenCalledWith(findOrigin('durango'));
  });

  it('never shows the raw coordinates in the UI once GPS mode is active', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 39.7047, longitude: -105.0814 },
      } as GeolocationPosition);
    });
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });

    render(<OriginPicker origin={findOrigin('denver')} onChange={vi.fn()} />);
    await user().click(screen.getByRole('button', { name: /use my current location/i }));

    await waitFor(() => expect(screen.getByText(/using your current location/i)).toBeInTheDocument());
    expect(screen.queryByText(/39\.7047/)).not.toBeInTheDocument();
    expect(screen.queryByText(/-105\.0814/)).not.toBeInTheDocument();
  });
});
