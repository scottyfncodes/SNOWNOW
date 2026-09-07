import type { DataSourceStatus } from '@/domain/plan';
import { DISPLAY_STATUS_LABEL } from '@/domain/provenance';

/**
 * The disclosure the honesty rules actually earn: one aggregate badge on the
 * card is enough for a glance, but the moment more than one provider can be
 * live while another is demo, someone is going to ask "wait, which parts of
 * this are real?" — this is the answer, expandable, never hidden.
 */
export function DataSources({ sources }: { sources: DataSourceStatus[] }) {
  return (
    <ul className="datasources">
      {sources.map((source) => (
        <li key={source.label} className="datasources-row">
          <span className="datasources-label">{source.label}</span>
          <span className={`chip chip-${source.status}`}>{DISPLAY_STATUS_LABEL[source.status]}</span>
          <span className="datasources-provider">
            {source.provider}
            {source.fetchedAt && ` · fetched ${relativeTime(source.fetchedAt)}`}
            {source.sourceUrl && (
              <>
                {' · '}
                <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                  official source
                </a>
              </>
            )}
          </span>
          {/* Never let a third-party feed read as if it came from the resort itself. */}
          {source.attribution && <span className="datasources-attribution">{source.attribution}</span>}
        </li>
      ))}
    </ul>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes <= 0) return 'just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? '1 hr ago' : `${hours} hr ago`;
}
