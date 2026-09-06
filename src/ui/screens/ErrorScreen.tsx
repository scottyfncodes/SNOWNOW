export interface ErrorScreenProps {
  message: string;
  onRetry?: () => void;
  onBack: () => void;
}

/** Never a broken dashboard. Say what happened, offer the way out. */
export function ErrorScreen({ message, onRetry, onBack }: ErrorScreenProps) {
  return (
    <main className="errorscreen shell">
      <p className="eyebrow">Well, that's annoying</p>
      <h1 className="errorscreen-head">WE CAN'T CALL THIS ONE.</h1>
      <p className="errorscreen-body">{message}</p>
      <div className="errorscreen-actions">
        {onRetry && (
          <button type="button" className="button" onClick={onRetry}>
            Try again
          </button>
        )}
        <button type="button" className="button button-quiet" onClick={onBack}>
          Back
        </button>
      </div>
    </main>
  );
}
