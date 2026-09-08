import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OriginPicker } from './OriginPicker';

const user = () => userEvent.setup();

afterEach(() => {
  vi.unstubAllGlobals();
  // @ts-expect-error -- test cleanup of a jsdom global that has no type by default
  delete navigator.geolocation;
});

describe('OriginPicker — use my location', () => {
  it('finds the closest known starting city from a real position and selects it', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 40.02, longitude: -105.28 }, // near Boulder
      } as GeolocationPosition);
    });
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });

    const onChange = vi.fn();
    render(<OriginPicker value="denver" onChange={onChange} />);

    await user().click(screen.getByRole('button', { name: /use my current location/i }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('boulder'));
    expect(screen.getByText(/closest starting city: boulder/i)).toBeInTheDocument();
  });

  it('shows a plain-language message and never crashes when location access is denied', async () => {
    const getCurrentPosition = vi.fn(
      (_success: PositionCallback, error: PositionErrorCallback) => {
        error({ code: 1, PERMISSION_DENIED: 1, message: 'denied' } as GeolocationPositionError);
      },
    );
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });

    const onChange = vi.fn();
    render(<OriginPicker value="denver" onChange={onChange} />);

    await user().click(screen.getByRole('button', { name: /use my current location/i }));

    await waitFor(() => expect(screen.getByText(/pick a city instead/i)).toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("tells the user plainly when the browser can't share location at all, instead of failing silently", async () => {
    vi.stubGlobal('navigator', { ...navigator, geolocation: undefined });

    render(<OriginPicker value="denver" onChange={vi.fn()} />);
    await user().click(screen.getByRole('button', { name: /use my current location/i }));

    expect(screen.getByText(/can't share your location/i)).toBeInTheDocument();
  });

  it('still lets you pick a city from the dropdown directly', async () => {
    const onChange = vi.fn();
    render(<OriginPicker value="denver" onChange={onChange} />);
    await user().selectOptions(screen.getByLabelText(/starting from/i), 'durango');
    expect(onChange).toHaveBeenCalledWith('durango');
  });
});
