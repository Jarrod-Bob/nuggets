// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveUpdatesProvider, type LiveEvent } from '../live/LiveUpdates';
import { TagsProvider } from '../tags/TagsProvider';
import { NuggetPage } from './NuggetPage';
import type { Idea, TagSuggestion } from '../api';

/** Stands in for the browser's EventSource so a test can send events. */
class FakeEventSource {
  static readonly CLOSED = 2;
  static latest: FakeEventSource | null = null;
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, Array<() => void>>();
  constructor() {
    FakeEventSource.latest = this;
  }
  addEventListener(name: string, fn: () => void) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), fn]);
  }
  close() {
    this.readyState = FakeEventSource.CLOSED;
  }
  async emit(name: LiveEvent) {
    await act(async () => {
      for (const fn of this.listeners.get(name) ?? []) fn();
    });
  }
}

const idea: Idea = {
  id: 1,
  title: 'Meal planner',
  notes: '',
  project_name: '',
  tags: ['home'],
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

/** The nugget as the server holds it. */
let current: Idea;
/** What GET /api/ideas/1/tag-suggestions answers. */
let suggestions: TagSuggestion[];

const calls = (method: string, path: string) =>
  vi
    .mocked(fetch)
    .mock.calls.filter(([p, init]) => p === path && (init?.method ?? 'GET') === method)
    .map(([, init]) => (init?.body ? JSON.parse(String(init.body)) : null));

beforeEach(() => {
  current = idea;
  suggestions = [];
  FakeEventSource.latest = null;
  vi.stubGlobal('EventSource', FakeEventSource);
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (path === '/api/tags') return Promise.resolve(json([]));
      if (path === '/api/ideas/1/github-issues') return Promise.resolve(json([]));
      if (path === '/api/ideas/1/tag-suggestions') return Promise.resolve(json(suggestions));
      if (path.startsWith('/api/ideas/1/tag-suggestions/') && method === 'POST') return Promise.resolve(new Response(null, { status: 204 }));
      if (path === '/api/ideas/1' && method === 'PATCH') {
        const draft = JSON.parse(String(init?.body));
        current = { ...current, ...draft };
        suggestions = suggestions.filter((s) => !current.tags.includes(s.tag));
        return Promise.resolve(json(current));
      }
      if (path === '/api/ideas/1') return Promise.resolve(json(current));
      return Promise.resolve(json({ error: { message: 'unexpected' } }, 500));
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

const row = () => screen.queryByRole('list', { name: 'Suggested tags' });

describe('NuggetPage tag suggestions', () => {
  it('shows no row for a nugget without suggestions', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Meal planner' });
    expect(row()).toBeNull();
    expect(screen.queryByText('Suggested tags')).toBeNull();
  });

  it('shows each suggestion with Add and Dismiss, without its probability', async () => {
    suggestions = [
      { tag: 'cooking', probability: 0.93 },
      { tag: 'weekend', probability: 0.71 },
    ];
    renderPage();
    const list = await screen.findByRole('list', { name: 'Suggested tags' });
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('cooking'),
      expect.stringContaining('weekend'),
    ]);
    expect(screen.getByRole('button', { name: 'Add the tag cooking' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dismiss the tag weekend' })).toBeTruthy();
    expect(list.textContent).not.toMatch(/0\.9|93|%/);
  });

  it('hides the row while the edit form is open', async () => {
    suggestions = [{ tag: 'cooking', probability: 0.9 }];
    renderPage();
    await screen.findByRole('list', { name: 'Suggested tags' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(row()).toBeNull();
  });

  it('Add saves the current tags plus the suggested one', async () => {
    suggestions = [{ tag: 'cooking', probability: 0.9 }];
    renderPage();
    await screen.findByRole('list', { name: 'Suggested tags' });
    // The server has gained a tag since the page loaded; Add must keep it.
    current = { ...current, tags: ['home', 'kitchen'] };

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add the tag cooking' }));
    });

    expect(calls('PATCH', '/api/ideas/1')).toEqual([{ tags: ['home', 'kitchen', 'cooking'] }]);
    expect(row()).toBeNull();
    expect(await screen.findByRole('link', { name: 'cooking' })).toBeTruthy();
  });

  it('Dismiss calls the endpoint and removes the chip', async () => {
    suggestions = [
      { tag: 'cooking', probability: 0.9 },
      { tag: 'weekend', probability: 0.8 },
    ];
    renderPage();
    await screen.findByRole('list', { name: 'Suggested tags' });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss the tag weekend' }));
    });

    expect(calls('POST', '/api/ideas/1/tag-suggestions/weekend/dismiss')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Dismiss the tag weekend' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Dismiss the tag cooking' })).toBeTruthy();
  });

  it('refetches when suggestions change in the background', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Meal planner' });
    expect(row()).toBeNull();

    suggestions = [{ tag: 'cooking', probability: 0.9 }];
    await FakeEventSource.latest!.emit('tag-suggestions-changed');
    expect(await screen.findByRole('list', { name: 'Suggested tags' })).toBeTruthy();

    suggestions = [];
    await FakeEventSource.latest!.emit('ideas-changed');
    expect(row()).toBeNull();
  });
});
