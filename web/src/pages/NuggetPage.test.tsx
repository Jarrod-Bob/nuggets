// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveUpdatesProvider } from '../live/LiveUpdates';
import { TagsProvider } from '../tags/TagsProvider';
import { NuggetPage } from './NuggetPage';
import type { FeatureRequest, Idea } from '../api';

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
/** What GET /api/ideas/1/github-issues answers. */
let requests: FeatureRequest[];

beforeEach(() => {
  answer = async () => json(idea);
  requests = [];
  vi.stubGlobal('EventSource', QuietEventSource);
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/tags') return Promise.resolve(json([]));
      if (path === '/api/ideas/1/github-issues') return Promise.resolve(json(requests));
      if (path.startsWith('/api/github-issues/') && init?.method === 'POST') {
        requests = requests.map((r) => (r.state === 'failed' ? { ...r, state: 'pending', last_error: undefined } : r));
        return Promise.resolve(json(requests[0]));
      }
      return answer();
    }),
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

const request = (overrides: Partial<FeatureRequest>): FeatureRequest => ({
  id: 7,
  idea_id: 1,
  repo: 'Jarrod-Bob/nuggets',
  tag: 'nuggets',
  state: 'pending',
  attempts: 0,
  ...overrides,
});

describe('NuggetPage feature requests', () => {
  it('links to the created issue', async () => {
    requests = [request({ state: 'created', number: 42, url: 'https://github.com/Jarrod-Bob/nuggets/issues/42' })];
    renderPage();
    const link = (await screen.findByRole('link', { name: 'Feature request #42' })) as HTMLAnchorElement;
    expect(link.href).toBe('https://github.com/Jarrod-Bob/nuggets/issues/42');
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('shows a queued request with the error its retry is waiting on', async () => {
    requests = [request({ state: 'sending', attempts: 1, last_error: "Couldn't reach GitHub: timeout" })];
    renderPage();
    expect(await screen.findByText('Feature request queued')).toBeTruthy();
    expect(screen.getByText("Couldn't reach GitHub: timeout")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('shows a failed request with its error and retries it', async () => {
    requests = [request({ state: 'failed', attempts: 1, last_error: 'GitHub answered 404: Not Found.' })];
    renderPage();
    expect(await screen.findByText('Feature request failed')).toBeTruthy();
    expect(screen.getByText('GitHub answered 404: Not Found.')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    expect(await screen.findByText('Feature request queued')).toBeTruthy();
    expect(screen.queryByText('Feature request failed')).toBeNull();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/github-issues/7/retry', expect.objectContaining({ method: 'POST' }));
  });

  it('shows nothing for a nugget with no feature request', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'A loaded nugget' });
    expect(screen.queryByRole('list', { name: 'Feature requests' })).toBeNull();
  });
});
