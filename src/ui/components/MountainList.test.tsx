import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { testMountain } from '@/test/fixtures';
import { MountainList } from './MountainList';

const user = () => userEvent.setup();

describe('MountainList', () => {
  it('sorts mountains alphabetically regardless of input order', () => {
    const mountains = [
      testMountain({ id: 'vail', name: 'Vail' }),
      testMountain({ id: 'a-basin', name: 'Arapahoe Basin' }),
      testMountain({ id: 'monarch', name: 'Monarch Mountain' }),
    ];
    render(<MountainList mountains={mountains} onSelectMountain={vi.fn()} />);

    const names = screen.getAllByRole('button').map((button) => button.textContent);
    const positions = ['Arapahoe Basin', 'Monarch Mountain', 'Vail'].map((name) =>
      names.findIndex((text) => text?.startsWith(name)),
    );
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(positions.every((position) => position >= 0)).toBe(true);
  });

  it('calls onSelectMountain with the mountain id when a row is tapped', async () => {
    const onSelectMountain = vi.fn();
    const mountains = [testMountain({ id: 'vail', name: 'Vail' })];
    render(<MountainList mountains={mountains} onSelectMountain={onSelectMountain} />);

    await user().click(screen.getByRole('button', { name: /vail/i }));
    expect(onSelectMountain).toHaveBeenCalledWith('vail');
  });

  it('does not show an Epic Pass badge in the list — this view is names and stats, not pass status', () => {
    const mountains = [
      testMountain({ id: 'vail', name: 'Vail', passAffiliations: ['epic'] }),
      testMountain({ id: 'copper', name: 'Copper Mountain', passAffiliations: ['ikon'] }),
    ];
    render(<MountainList mountains={mountains} onSelectMountain={vi.fn()} />);

    expect(screen.queryByText('Epic Pass')).not.toBeInTheDocument();
  });

  it('shows real profile detail — region, trail count, vertical — not just a bare name', () => {
    const mountains = [
      testMountain({
        id: 'vail',
        name: 'Vail',
        region: 'Vail Valley',
        terrain: { trails: 195, acres: 5317, aboveTreelineShare: 0.3, lateOpeningShare: 0.1 },
        elevations: { baseFt: 8120, summitFt: 11570, verticalFt: 3450 },
      }),
    ];
    render(<MountainList mountains={mountains} onSelectMountain={vi.fn()} />);

    expect(screen.getByText(/Vail Valley/)).toBeInTheDocument();
    expect(screen.getByText(/195 trails/)).toBeInTheDocument();
    expect(screen.getByText(/3,450.*vertical/)).toBeInTheDocument();
  });
});
