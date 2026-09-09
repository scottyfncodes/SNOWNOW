import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { MountainProfile } from '@/domain/mountainProfile';
import { TBD_DATE } from '@/domain/mountainProfile';
import { testMountain } from '@/test/fixtures';
import { MountainProfilePanel } from './MountainProfilePanel';

const baseProfile: MountainProfile = {
  officialWebsite: 'https://example.test',
  snowReportUrl: null,
  webcamUrl: null,
  trailMapUrl: null,
  ticketUrl: null,
  passInfoUrl: null,
  phone: null,
  address: null,
  openingDate: TBD_DATE,
  closingDate: TBD_DATE,
};

describe('MountainProfilePanel — Epic Pass badge', () => {
  it('shows an Epic Pass badge next to the name for a mountain on the Epic Pass', () => {
    const mountain = testMountain({ passAffiliations: ['epic'] });
    render(<MountainProfilePanel mountain={mountain} profile={baseProfile} />);
    expect(screen.getByText('Epic Pass')).toBeInTheDocument();
  });

  it('shows no badge for a mountain on a different pass', () => {
    const mountain = testMountain({ passAffiliations: ['ikon'] });
    render(<MountainProfilePanel mountain={mountain} profile={baseProfile} />);
    expect(screen.queryByText('Epic Pass')).not.toBeInTheDocument();
  });

  it('shows no badge even without a researched profile at all', () => {
    const mountain = testMountain({ passAffiliations: ['independent'] });
    render(<MountainProfilePanel mountain={mountain} profile={null} />);
    expect(screen.queryByText('Epic Pass')).not.toBeInTheDocument();
    expect(screen.getByText(mountain.name)).toBeInTheDocument();
  });
});

describe('MountainProfilePanel — food & drink', () => {
  it('lists researched picks by name', () => {
    const mountain = testMountain();
    const profile: MountainProfile = {
      ...baseProfile,
      dining: {
        picks: [
          { name: "Garfinkel's", note: 'Base-area sports bar.' },
          { name: 'Sweet Basil', note: 'Elevated seasonal American.' },
        ],
      },
    };
    render(<MountainProfilePanel mountain={mountain} profile={profile} />);
    expect(screen.getByText("Garfinkel's")).toBeInTheDocument();
    expect(screen.getByText('Sweet Basil')).toBeInTheDocument();
  });

  it('names the real nearby town instead of pretending the mountain has its own scene', () => {
    const mountain = testMountain();
    const profile: MountainProfile = {
      ...baseProfile,
      dining: {
        town: 'Pagosa Springs, about 25 miles west',
        picks: [{ name: "Kip's", note: 'Baja-style tacos downtown.' }],
      },
    };
    render(<MountainProfilePanel mountain={mountain} profile={profile} />);
    expect(screen.getByText(/most people eat in Pagosa Springs/)).toBeInTheDocument();
  });

  it('says food and drink has not been researched yet rather than showing an empty list', () => {
    const mountain = testMountain();
    render(<MountainProfilePanel mountain={mountain} profile={baseProfile} />);
    expect(screen.getByText(/haven't researched food and drink/)).toBeInTheDocument();
  });
});
