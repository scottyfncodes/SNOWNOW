import { useState } from 'react';
import { ORIGINS, nearestOrigin } from '@/data/origins';

export interface OriginPickerProps {
  value: string;
  onChange: (originId: string) => void;
}

type LocateState = { status: 'idle' } | { status: 'locating' } | { status: 'done'; label: string } | { status: 'error'; message: string };

/**
 * There's no drive-time model for an arbitrary point on the map — every
 * mountain's routes are hand-authored per known starting city (see
 * `data/mountains.ts`). So "use my location" is honest about what it
 * actually does: finds the closest of the cities SNOWNOW already knows how
 * to route from, rather than pretending to route from your exact address.
 */
function useLocate(onChange: (originId: string) => void) {
  const [state, setState] = useState<LocateState>({ status: 'idle' });

  const locate = () => {
    if (!navigator.geolocation) {
      setState({ status: 'error', message: "This browser can't share your location." });
      return;
    }
    setState({ status: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const closest = nearestOrigin({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        onChange(closest.id);
        setState({ status: 'done', label: closest.name });
      },
      (error) => {
        setState({
          status: 'error',
          message: error.code === error.PERMISSION_DENIED
            ? 'Location access was denied — pick a city instead.'
            : "Couldn't get your location — pick a city instead.",
        });
      },
      { timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  };

  return { state, locate };
}

/** Minimal typing: where you're starting from is a tap, not a text field. */
export function OriginPicker({ value, onChange }: OriginPickerProps) {
  const { state, locate } = useLocate(onChange);

  return (
    <div className="originpicker">
      <div className="originpicker-row">
        <label className="originpicker-label" htmlFor="origin-select">
          Starting from
        </label>
        <div className="originpicker-control">
          <select
            id="origin-select"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          >
            {ORIGINS.map((origin) => (
              <option key={origin.id} value={origin.id}>
                {origin.name}
              </option>
            ))}
          </select>
          <span aria-hidden="true" className="originpicker-chevron">
            ▾
          </span>
        </div>
      </div>
      <button
        type="button"
        className="originpicker-locate"
        onClick={locate}
        disabled={state.status === 'locating'}
      >
        <span aria-hidden="true">📍</span>
        {state.status === 'locating' ? 'Finding you…' : 'Use my current location'}
      </button>
      {state.status === 'done' && (
        <p className="originpicker-locate-status">Closest starting city: {state.label}</p>
      )}
      {state.status === 'error' && <p className="originpicker-locate-status">{state.message}</p>}
    </div>
  );
}
