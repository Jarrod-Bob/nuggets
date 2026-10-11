// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

afterEach(cleanup);

describe('the Comic dialog', () => {
  it('is named by its title', () => {
    render(
      <Dialog title="Your challenge" onClose={() => {}}>
        <p>Body</p>
      </Dialog>,
    );
    expect(screen.getByRole('dialog', { name: 'Your challenge' })).toBeTruthy();
    expect(screen.getByText('Body')).toBeTruthy();
  });

  it('closes from its close button', () => {
    const onClose = vi.fn();
    render(<Dialog title="Edit" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<Dialog title="Edit" onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows its footer', () => {
    render(<Dialog title="Edit" onClose={() => {}} footer={<button type="button">Save</button>} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });
});
