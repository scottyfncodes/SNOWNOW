import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Wordmark } from './Wordmark';

const user = () => userEvent.setup();

describe('Wordmark', () => {
  it('renders the plain wordmark with no interactive parts when no toggle handler is given', () => {
    render(<Wordmark />);
    expect(screen.getByText('SNOW')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('makes the O a real, labelled, focusable toggle when a handler is given', async () => {
    const onToggleEpicOnly = vi.fn();
    render(<Wordmark epicOnly={false} onToggleEpicOnly={onToggleEpicOnly} />);

    const toggle = screen.getByRole('button', { name: /show epic pass mountains only/i });
    expect(toggle).toHaveTextContent('O');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user().click(toggle);
    expect(onToggleEpicOnly).toHaveBeenCalledTimes(1);
  });

  it('reflects the active state in its label and pressed state, not just its color', () => {
    render(<Wordmark epicOnly={true} onToggleEpicOnly={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: /showing epic pass mountains only/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});
