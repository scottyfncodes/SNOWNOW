import type { Mountain } from '@/domain/mountain';

/** A quiet marker — never the resort's own pass-program branding, just a fact from `Mountain.passAffiliations`. */
export function EpicPassBadge({ mountain }: { mountain: Mountain }) {
  if (!mountain.passAffiliations.includes('epic')) return null;
  return (
    <span className="chip chip-pass-epic" title="Included on the Epic Pass">
      Epic Pass
    </span>
  );
}
