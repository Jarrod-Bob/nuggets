// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IdeaCard } from './IdeaCard';

afterEach(cleanup);

describe('IdeaCard', () => {
  it('puts the project name behind a curry-sauce corner instead of a pill', () => {
    render(<IdeaCard title="A bank for little ideas" projectName="Ideanori" />);
    expect(screen.getByRole('heading').textContent).toBe('A bank for little ideas');
    // The sauce is a button whose label carries the name, so screen readers get it unrevealed.
    const sauce = screen.getByRole('button', { name: 'Project name: Ideanori' });
    expect(sauce.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByLabelText(/Suggested project name/)).toBeNull();
  });

  it('keeps the flood text out of the accessibility tree', () => {
    render(<IdeaCard title="A bank for little ideas" projectName="Ideanori" />);
    const flood = screen.getByText('Ideanori').closest('[aria-hidden="true"]');
    expect(flood).not.toBeNull();
  });

  it('toggles the reveal from the sauce without opening the nugget', () => {
    const onClick = vi.fn();
    render(<IdeaCard title="A bank for little ideas" projectName="Ideanori" onClick={onClick} />);
    const sauce = screen.getByRole('button', { name: 'Project name: Ideanori' });
    fireEvent.click(sauce);
    expect(sauce.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(sauce);
    expect(sauce.getAttribute('aria-expanded')).toBe('false');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('drains the reveal on Escape', () => {
    render(<IdeaCard title="A bank for little ideas" projectName="Ideanori" />);
    const sauce = screen.getByRole('button', { name: 'Project name: Ideanori' });
    fireEvent.click(sauce);
    fireEvent.keyDown(sauce, { key: 'Escape' });
    expect(sauce.getAttribute('aria-expanded')).toBe('false');
  });

  it('still opens the nugget when the revealed flood is clicked', () => {
    const onClick = vi.fn();
    render(<IdeaCard title="A bank for little ideas" projectName="Ideanori" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Project name: Ideanori' }));
    fireEvent.click(screen.getByText('Ideanori'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has no sauce without a project name', () => {
    render(<IdeaCard title="A bank for little ideas" projectName="" />);
    expect(screen.queryByRole('button', { name: /Project name/ })).toBeNull();
  });
});
