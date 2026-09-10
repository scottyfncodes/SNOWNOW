export interface WordmarkProps {
  size?: 'sm' | 'lg';
  /** When present, the O in "NOW" becomes a real (undecorated) toggle button. */
  epicOnly?: boolean;
  onToggleEpicOnly?: () => void;
}

/**
 * The O in "NOW" doubles as an undocumented toggle for a mountain who
 * happens to click it: filter the map down to Epic Pass resorts only. It's
 * styled to be indistinguishable from the letters on either side of it —
 * finding it is the point — but it's still a real, focusable, labelled
 * button underneath, not a mouse-only trick.
 */
export function Wordmark({ size = 'lg', epicOnly = false, onToggleEpicOnly }: WordmarkProps) {
  return (
    <span className={`wordmark wordmark-${size}`}>
      SNOW
      <span className="wordmark-now">
        N
        {onToggleEpicOnly ? (
          <button
            type="button"
            className={`wordmark-o${epicOnly ? ' is-active' : ''}`}
            onClick={onToggleEpicOnly}
            aria-pressed={epicOnly}
            aria-label={
              epicOnly ? 'Showing Epic Pass mountains only — tap to show all mountains' : 'Show Epic Pass mountains only'
            }
          >
            O
          </button>
        ) : (
          'O'
        )}
        W
      </span>
    </span>
  );
}
