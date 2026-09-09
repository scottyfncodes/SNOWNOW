import { useState } from 'react';
import { gpsOrigin } from '@/data/origins';
import type { Origin } from '@/domain/mountain';

export interface OriginPickerProps {
  onChange: (origin: Origin) => void;
}

type LocateState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'found' }
  | { status: 'denied'; message: string }
  | { status: 'error'; message: string };

const GEOLOCATION_OPTIONS: PositionOptions = {
  // Driving-origin selection wants the best fix the device can give, not the
  // battery-friendly default.
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 0,
};

/**
 * The user's exact coordinates become the routing origin directly — SNOWNOW
 * no longer snaps a GPS fix to whichever of the six manual cities is
 * closest. Permission is only ever requested here, on tap; never on mount.
 */
function useLocate(onChange: (origin: Origin) => void) {
  const [state, setState] = useState<LocateState>({ status: 'idle' });

  const locate = () => {
    if (!navigator.geolocation) {
      setState({
        status: 'error',
        message: "This browser can't share your location.",
      });
      return;
    }
    setState({ status: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange(gpsOrigin(position.coords.latitude, position.coords.longitude));
        setState({ status: 'found' });
      },
      (error) => {
        // The browser reports the same PERMISSION_DENIED code whether this is
        // the first time or the tenth — there's no API to tell those apart
        // before asking, so one message has to cover both. What it can't
        // leave out is *where* to fix it: the setting isn't inside the page
        // at all but under Settings → Safari → Location (or, for an
        // installed Home Screen app, Settings → [App Name] → Location).
        if (error.code === error.PERMISSION_DENIED) {
          setState({
            status: 'denied',
            message:
              'Location access is off for SNOWNOW. Enable it in Settings → Safari → Location (or Settings → SNOWNOW → Location if you added it to your Home Screen), then try again.',
          });
          return;
        }
        if (error.code === error.TIMEOUT) {
          setState({
            status: 'error',
            message: 'Location took too long to find. Try again.',
          });
          return;
        }
        if (error.code === error.POSITION_UNAVAILABLE) {
          setState({
            status: 'error',
            message: "Your device couldn't get a location fix right now — try again somewhere with a clearer view of the sky.",
          });
          return;
        }
        setState({
          status: 'error',
          message: "Couldn't determine your location. Try again.",
        });
      },
      GEOLOCATION_OPTIONS,
    );
  };

  return { state, locate };
}

/**
 * GPS is the only way to set where you're starting from — no manual city
 * list. A location fix is either the real thing or nothing; "closest to
 * Denver" was never a substitute worth offering once the real one works.
 */
export function OriginPicker({ onChange }: OriginPickerProps) {
  const { state, locate } = useLocate(onChange);

  return (
    <div className="originpicker">
      <button
        type="button"
        className="originpicker-locate"
        onClick={locate}
        disabled={state.status === 'locating'}
        aria-busy={state.status === 'locating'}
      >
        <span aria-hidden="true">📍</span>
        {state.status === 'locating' ? 'Finding your location…' : 'Use my current location'}
      </button>
      {state.status === 'found' && (
        <p className="originpicker-locate-status">Using your current location</p>
      )}
      {(state.status === 'denied' || state.status === 'error') && (
        <p className="originpicker-locate-status">{state.message}</p>
      )}
    </div>
  );
}
