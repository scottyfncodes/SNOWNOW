import type { Mountain } from '@/domain/mountain';
import type { MountainProfile, SeasonDate } from '@/domain/mountainProfile';

export interface MountainProfilePanelProps {
  mountain: Mountain;
  profile: MountainProfile | null;
}

/**
 * The deeper reference sheet for a mountain: official links, contact info,
 * and season dates. Deliberately not shown on the NOW card — this is where
 * that information belongs instead, reached from the map (see MapScreen).
 *
 * Every field here either shows a real value or an honest "not available"
 * state — never a guessed URL, an invented date, or a silently blank row.
 */
export function MountainProfilePanel({ mountain, profile }: MountainProfilePanelProps) {
  if (!profile) {
    return (
      <section className="panel profile-panel" aria-labelledby="profile-heading">
        <h2 id="profile-heading" className="section-title profile-title">
          {mountain.name}
          <EpicPassBadge mountain={mountain} />
        </h2>
        <p className="profile-unavailable">
          We don't have a researched profile for this mountain yet — not currently available.
        </p>
      </section>
    );
  }

  return (
    <section className="panel profile-panel" aria-labelledby="profile-heading">
      <header className="panel-head">
        <h2 id="profile-heading" className="section-title profile-title">
          {mountain.name}
          <EpicPassBadge mountain={mountain} />
        </h2>
        <a className="profile-website" href={profile.officialWebsite} target="_blank" rel="noreferrer">
          Official site ↗
        </a>
      </header>

      <dl className="profile-grid">
        <ProfileRow label="Opening" value={<SeasonDateValue value={profile.openingDate} />} />
        <ProfileRow label="Closing" value={<SeasonDateValue value={profile.closingDate} />} />
        <ProfileRow label="Address" value={profile.address ?? 'Not currently available'} />
        <ProfileRow
          label="Phone"
          value={
            profile.phone ? (
              <a href={`tel:${profile.phone.replace(/[^\d+]/g, '')}`}>{profile.phone}</a>
            ) : (
              'Not currently available'
            )
          }
        />
      </dl>

      <section className="profile-parking" aria-labelledby="profile-parking-heading">
        <h3 id="profile-parking-heading" className="eyebrow">
          Parking
        </h3>
        {profile.parking?.note || profile.parking?.infoUrl ? (
          <>
            {profile.parking.note && <p className="profile-parking-note">{profile.parking.note}</p>}
            {profile.parking.reservationRequired != null && (
              <p className="profile-parking-note">
                {profile.parking.reservationRequired
                  ? 'A paid or reserved space is required.'
                  : 'No reservation is required.'}
              </p>
            )}
            {profile.parking.infoUrl && (
              <a href={profile.parking.infoUrl} target="_blank" rel="noreferrer">
                Parking details ↗
              </a>
            )}
          </>
        ) : (
          <p className="profile-parking-note">
            We haven't researched parking specifics for this mountain yet. Check{' '}
            <a href={profile.officialWebsite} target="_blank" rel="noreferrer">
              the mountain's own site
            </a>{' '}
            before you go — we won't guess at lots, fees, or reservations.
          </p>
        )}
      </section>

      <section className="profile-dining" aria-labelledby="profile-dining-heading">
        <h3 id="profile-dining-heading" className="eyebrow">
          Food &amp; Drink
        </h3>
        {profile.dining ? (
          <>
            {profile.dining.town && (
              <p className="profile-dining-note">
                There's little to no base-area dining here — most people eat in {profile.dining.town}.
              </p>
            )}
            <ul className="profile-dining-list">
              {profile.dining.picks.map((pick) => (
                <li key={pick.name}>
                  <strong>{pick.name}</strong> — {pick.note}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="profile-dining-note">
            We haven't researched food and drink options for this mountain yet.
          </p>
        )}
      </section>

      <ul className="profile-links">
        <ProfileLink label="Snow report" href={profile.snowReportUrl} />
        <ProfileLink label="Webcams" href={profile.webcamUrl} />
        <ProfileLink label="Trail map" href={profile.trailMapUrl} />
        <ProfileLink label="Lift tickets" href={profile.ticketUrl} />
        <ProfileLink label="Pass info" href={profile.passInfoUrl} />
      </ul>

      {profile.notes && (
        <p className="profile-note">
          <span className="eyebrow">Research notes</span> {profile.notes}
        </p>
      )}
    </section>
  );
}

/** A quiet marker next to the name — never the resort's own pass-program branding, just a fact from `Mountain.passAffiliations`. */
function EpicPassBadge({ mountain }: { mountain: Mountain }) {
  if (!mountain.passAffiliations.includes('epic')) return null;
  return (
    <span className="chip chip-pass-epic" title="Included on the Epic Pass">
      Epic Pass
    </span>
  );
}

function ProfileRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="profile-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ProfileLink({ label, href }: { label: string; href: string | null }) {
  return (
    <li className={href ? undefined : 'is-unavailable'}>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer">
          {label} ↗
        </a>
      ) : (
        <span>
          {label} — <span className="faint">not currently available</span>
        </span>
      )}
    </li>
  );
}

function SeasonDateValue({ value }: { value: SeasonDate }) {
  if (!value.date) return <>Not yet announced</>;
  const formatted = new Date(`${value.date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return (
    <>
      {formatted}
      {value.status !== 'confirmed' && <span className="faint"> (projected)</span>}
    </>
  );
}
