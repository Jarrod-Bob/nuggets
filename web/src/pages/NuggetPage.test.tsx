// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveUpdatesProvider } from '../live/LiveUpdates';
import { TagsProvider } from '../tags/TagsProvider';
import { NuggetPage } from './NuggetPage';
import type { Idea } from '../api';

class QuietEventSource {
  static readonly CLOSED = 2;
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  addEventListener() {}
  close() {
    this.readyState = QuietEventSource.CLOSED;
  }
}

const idea: Idea = {
  id: 1,
  title: 'A loaded nugget',
  notes: '',
  tags: [],
  status: 'raw',
  links: [],
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  archived_at: null,
  source: null,
  source_ref: null,
  origin: null,
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** What GET /api/ideas/1 answers next. */
let answer: () => Promise<Response>;

beforeEach(() => {
  answer = async () => json(idea);
  vi.stubGlobal('EventSource', QuietEventSource);
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string) => (path === '/api/tags' ? Promise.resolve(json([])) : answer())),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderPage = () =>
  render(
    <LiveUpdatesProvider>
      <TagsProvider>
        <MemoryRouter initialEntries={['/nuggets/1']}>
          <Routes>
            <Route path="/nuggets/:id" element={<NuggetPage />} />
          </Routes>
        </MemoryRouter>
      </TagsProvider>
    </LiveUpdatesProvider>,
  );

/** Showing the tab fires every live listener, so the page reloads its nugget. */
const refresh = async () => {
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

describe('NuggetPage refresh', () => {
  it('keeps the loaded nugget when a refresh fails with anything but a 404', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'A loaded nugget' })).toBeTruthy();

    answer = () => Promise.reject(new TypeError('Failed to fetch'));
    await refresh();
    answer = async () => json({ error: { message: 'database is locked' } }, 500);
    await refresh();

    expect(screen.getByRole('heading', { name: 'A loaded nugget' })).toBeTruthy();
    expect(screen.queryByText('Not in the bank')).toBeNull();
  });

  it('shows not-found when a refresh finds the nugget gone', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'A loaded nugget' });

    answer = async () => json({ error: { message: 'idea not found' } }, 404);
    await refresh();

    expect(screen.getByText('Not in the bank')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'A loaded nugget' })).toBeNull();
  });

  it('shows not-found when the first load fails', async () => {
    answer = () => Promise.reject(new TypeError('Failed to fetch'));
    renderPage();
    expect(await screen.findByText('Not in the bank')).toBeTruthy();
  });
});
