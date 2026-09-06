import type { Provenance } from '@/domain/provenance';
import { confidenceLabel } from '@/domain/provenance';

/**
 * Data integrity, made visible. Demo numbers never appear without this badge,
 * and a forecast never wears the word LIVE.
 */
export function DataBadge({ provenance }: { provenance: Provenance }) {
  const isDemo = provenance.source === 'demo';
  const observationLabel =
    provenance.observation === 'observed'
      ? 'LIVE'
      : provenance.observation === 'forecast'
        ? 'FORECAST'
        : 'PROJECTED';

  // "LIVE" is a claim about reality. Demo data never gets to make it.
  if (isDemo) {
    return (
      <span className="badge-row">
        <span className="chip chip-demo">DEMO DATA</span>
        {provenance.observation !== 'observed' && (
          <span className="chip chip-projected">{observationLabel}</span>
        )}
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
