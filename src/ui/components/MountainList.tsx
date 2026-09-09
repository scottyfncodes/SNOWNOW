import type { Mountain } from '@/domain/mountain';
import { EpicPassBadge } from './EpicPassBadge';

export interface MountainListProps {
  mountains: Mountain[];
  onSelectMountain: (id: string) => void;
}

/**
 * The map's alternate, no-geography view: one alphabetized row per
 * mountain, each enough of a profile to browse by (region, terrain, the
 * character line used in explanations) without running the full day-plan
 * pipeline for every mountain just to populate a list — that stays reserved
 * for whichever one mountain gets tapped.
 */
export function MountainList({ mountains, onSelectMountain }: MountainListProps) {
  const sorted = [...mountains].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ul className="mountainlist" aria-label={`${sorted.length} Colorado mountains, alphabetical`}>
      {sorted.map((mountain) => (
        <li key={mountain.id}>
          <button type="button" className="mountainlist-row" onClick={() => onSelectMountain(mountain.id)}>
            <span className="mountainlist-name">
              {mountain.name}
              <EpicPassBadge mountain={mountain} />
            </span>
            <span className="mountainlist-meta">
              {mountain.region} · {mountain.terrain.trails} trails · {mountain.elevations.verticalFt.toLocaleString()}′ vertical
            </span>
            <span className="mountainlist-character">{mountain.character}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
