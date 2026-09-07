import { mostSevere, type WeatherAlert } from '@/domain/alerts';

/**
 * Official warnings, in the skier's own words. This never feeds the score —
 * the engine reasons about the same wind and snow numbers whether or not
 * there's a warning attached to them — it exists purely so a Winter Storm
 * Warning shows up as itself instead of getting silently absorbed into a
 * wind number nobody can see the reason for.
 */
export function AlertBanner({ alerts }: { alerts: WeatherAlert[] }) {
  const alert = mostSevere(alerts);
  if (!alert) return null;

  const expires = new Date(alert.expires);
  const expiresLabel = Number.isNaN(expires.getTime())
    ? null
    : expires.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div className={`alertbanner is-${alert.severity}`} role="status">
      <p className="alertbanner-event">{alert.event.toUpperCase()}</p>
      <p className="alertbanner-headline">
        {alert.headline}
        {expiresLabel && ` Until ${expiresLabel}.`}
      </p>
    </div>
  );
}
