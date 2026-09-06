import { ORIGINS } from '@/data/origins';

export interface OriginPickerProps {
  value: string;
  onChange: (originId: string) => void;
}

/** Minimal typing: where you're starting from is a tap, not a text field. */
export function OriginPicker({ value, onChange }: OriginPickerProps) {
  return (
    <div className="originpicker">
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
  );
}
