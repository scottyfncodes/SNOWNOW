import { describe, expect, it } from 'vitest';
import { MOUNTAINS } from '@/data/mountains';
import { MOUNTAIN_PROFILES, mountainProfileFor } from '@/data/mountainProfiles';

const HTTPS_ABSOLUTE = /^https:\/\/[^\s]+$/;

const isValidHttpsUrl = (value: string): boolean => {
  if (!HTTPS_ABSOLUTE.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.length > 0;
  } catch {
    return false;
  }
};

describe('mountain profiles — data integrity', () => {
  it('gives every mountain in the dataset a profile', () => {
    for (const mountain of MOUNTAINS) {
      expect(mountainProfileFor(mountain.id), `missing profile for ${mountain.id}`).not.toBeNull();
    }
  });

  it('never carries a profile for a mountain that does not exist', () => {
    const mountainIds = new Set(MOUNTAINS.map((mountain) => mountain.id));
    for (const id of Object.keys(MOUNTAIN_PROFILES)) {
      expect(mountainIds.has(id), `profile ${id} has no matching mountain`).toBe(true);
    }
  });

  it('gives every mountain a valid absolute https official website', () => {
    for (const mountain of MOUNTAINS) {
      const profile = mountainProfileFor(mountain.id)!;
      expect(isValidHttpsUrl(profile.officialWebsite), `${mountain.id} officialWebsite`).toBe(true);
    }
  });

  it('never fabricates a URL — every optional link is either a valid https URL or explicitly null', () => {
    const optionalUrlFields = ['snowReportUrl', 'webcamUrl', 'trailMapUrl', 'ticketUrl', 'passInfoUrl'] as const;
    for (const mountain of MOUNTAINS) {
      const profile = mountainProfileFor(mountain.id)!;
      for (const field of optionalUrlFields) {
        const value = profile[field];
        if (value === null) continue;
        expect(isValidHttpsUrl(value), `${mountain.id}.${field} = ${value}`).toBe(true);
      }
    }
  });

  it('only ever uses the three defined season-date statuses, and pairs "confirmed"/"projected" with a real date or leaves it null honestly', () => {
    const validStatuses = new Set(['confirmed', 'projected', 'tbd']);
    for (const mountain of MOUNTAINS) {
      const profile = mountainProfileFor(mountain.id)!;
      for (const seasonDate of [profile.openingDate, profile.closingDate]) {
        expect(validStatuses.has(seasonDate.status), `${mountain.id} season date status`).toBe(true);
        if (seasonDate.status === 'confirmed') {
          expect(seasonDate.date, `${mountain.id} confirmed date must not be null`).not.toBeNull();
        }
        if (seasonDate.date !== null) {
          expect(seasonDate.date, `${mountain.id} date shape`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      }
    }
  });

  it('never claims a confirmed opening/closing date this early in the 2026-27 season research pass', () => {
    // Every date recorded as of this research pass is, at best, a resort's own
    // published "target" — never treat that as `confirmed`.
    for (const mountain of MOUNTAINS) {
      const profile = mountainProfileFor(mountain.id)!;
      expect(profile.openingDate.status).not.toBe('confirmed');
      expect(profile.closingDate.status).not.toBe('confirmed');
    }
  });

  it('gives every mountain researched parking logistics, not a live feed', () => {
    for (const mountain of MOUNTAINS) {
      const profile = mountainProfileFor(mountain.id)!;
      expect(profile.parking, `missing parking info for ${mountain.id}`).toBeDefined();
      expect(profile.parking!.note, `${mountain.id} parking note`).toBeTruthy();
    }
  });

  it('never fabricates a parking info URL — either a valid https URL or explicitly null', () => {
    for (const mountain of MOUNTAINS) {
      const url = mountainProfileFor(mountain.id)!.parking?.infoUrl;
      if (url == null) continue;
      expect(isValidHttpsUrl(url), `${mountain.id} parking.infoUrl`).toBe(true);
    }
  });

  it('gives every mountain a researched Grub section with at least one pick and a quick-breakfast call-out', () => {
    for (const mountain of MOUNTAINS) {
      const profile = mountainProfileFor(mountain.id)!;
      expect(profile.grub, `missing grub info for ${mountain.id}`).toBeDefined();
      expect(profile.grub!.picks.length, `${mountain.id} grub picks`).toBeGreaterThan(0);
      expect(profile.grub!.quickBreakfast?.name, `${mountain.id} quick breakfast`).toBeTruthy();
    }
  });

  it('gives every mountain a researched Brews section with at least one brewery pick', () => {
    for (const mountain of MOUNTAINS) {
      const profile = mountainProfileFor(mountain.id)!;
      expect(profile.brews, `missing brews info for ${mountain.id}`).toBeDefined();
      expect(profile.brews!.picks.length, `${mountain.id} brews picks`).toBeGreaterThan(0);
    }
  });
});
