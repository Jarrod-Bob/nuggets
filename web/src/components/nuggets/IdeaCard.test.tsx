// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { IdeaCard } from './IdeaCard';

afterEach(cleanup);

describe('IdeaCard', () => {
  it('shows the project name under the title when there is one', () => {
    render(<IdeaCard title="A bank for little ideas" projectName="Ideanori" />);
    expect(screen.getByRole('heading').textContent).toBe('A bank for little ideas');
    expect(screen.getByText('Suggested project name: Ideanori')).toBeTruthy();
  });

  it('shows no project-name line without one', () => {
    render(<IdeaCard title="A bank for little ideas" projectName="" />);
    expect(screen.queryByText(/Suggested project name/)).toBeNull();
  });
});
