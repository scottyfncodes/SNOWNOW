import { confidenceLabel, displayStatus, type Provenance } from '@/domain/provenance';

/**
 * Data integrity, made visible. Demo numbers never appear without this badge,
 * a forecast never wears the word LIVE, and — the piece that matters once
 * real providers exist — a live value past its own freshness window says
 * STALE instead of quietly keeping the LIVE label it earned an hour ago.
 */
export function DataBadge({ provenance }: { provenance: Provenance }) {
  const status = displayStatus({ status: 'ok', provenance });
  const observationLabel =
    provenance.observation === 'observed'
      ? status === 'stale'
        ? 'STALE'
        : 'LIVE'
      : provenance.observation === 'forecast'
        ? 'FORECAST'
        : 'PROJECTED';

  if (status === 'demo') {
    return (
      <span className="badge-row">
        <span className="chip chip-demo">DEMO DATA</span>
        {provenance.observation !== 'observed' && (
          <span className="chip chip-projected">{observationLabel}</span>
        )}
      </span>
    );
  }

  if (status === 'stale') {
    return (
      <span className="badge-row">
        <span className="chip chip-stale" title="This was live data, but it's aged past its freshness window.">
          STALE
        </span>
      </span>
    );
  }

  return (
    <span className="badge-row">
      <span className="chip chip-live">{observationLabel}</span>
    </span>
  );
}

export function ConfidencePill({ level }: { level: Parameters<typeof confidenceLabel>[0] }) {
  return <span className={`chip confidence confidence-${level}`}>{confidenceLabel(level)}</span>;
}
