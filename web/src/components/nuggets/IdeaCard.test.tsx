// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { IdeaCard } from './IdeaCard';

afterEach(cleanup);

describe('IdeaCard', () => {
  it('shows the project name under the title when there is one', () => {
    render(<IdeaCard title="A bank for little ideas" projectName="Ideanori" />);
    expect(screen.getByRole('heading').textContent).toBe('A bank for little ideas');
    // A pill: the name shows, and "Suggested project name" is its tooltip and accessible label.
    const pill = screen.getByLabelText('Suggested project name: Ideanori');
    expect(pill.textContent).toContain('Ideanori');
    expect(pill.getAttribute('title')).toBe('Suggested project name');
    expect(screen.queryByText(/Suggested project name/)).toBeNull();
  });

  it('shows no project-name line without one', () => {
    render(<IdeaCard title="A bank for little ideas" projectName="" />);
    expect(screen.queryByLabelText(/Suggested project name/)).toBeNull();
  });
});
