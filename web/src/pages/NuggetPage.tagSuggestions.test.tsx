// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LOOKS } from '../looks/look';
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

describe.each(LOOKS)('under the %s look', (look) => {
  beforeEach(() => {
    document.documentElement.dataset.look = look;
  });
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

  const tray = () => screen.queryByRole('group', { name: 'Suggested tags' });
  const cooking: TagSuggestion = { tag: 'cooking', probability: 0.9, examples: ['Recipe box'] };
  const weekend: TagSuggestion = { tag: 'weekend', probability: 0.8, examples: ['Bike shed', 'Picnic map'] };

  describe('NuggetPage tag suggestions', () => {
    it('shows no tray for a nugget without suggestions', async () => {
      renderPage();
      await screen.findByRole('heading', { name: 'Meal planner' });
      expect(tray()).toBeNull();
      expect(screen.queryByText('suggested')).toBeNull();
    });

    it('puts the tray in the tag row, after the real tags', async () => {
      suggestions = [cooking, weekend];
      renderPage();
      const group = await screen.findByRole('group', { name: 'Suggested tags' });
      const realTag = screen.getByRole('link', { name: 'home' });
      expect(group.parentElement).toBe(realTag.parentElement);
      expect(realTag.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(within(group).getAllByRole('button', { name: /^Add the suggested tag / }).map((b) => b.textContent)).toEqual([
        'cooking',
        'weekend',
      ]);
      expect(group.textContent).not.toMatch(/0\.9|90|%/);
    });

    it('shows the tray for a nugget with no tags yet', async () => {
      current = { ...idea, tags: [] };
      suggestions = [cooking];
      renderPage();
      expect(await screen.findByRole('group', { name: 'Suggested tags' })).toBeTruthy();
    });

    it('hides the tray while the edit form is open', async () => {
      suggestions = [cooking];
      renderPage();
      await screen.findByRole('group', { name: 'Suggested tags' });
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      expect(tray()).toBeNull();
    });

    it('hides the tray on an archived nugget', async () => {
      current = { ...idea, archived_at: '2026-09-02T00:00:00Z' };
      suggestions = [cooking];
      renderPage();
      await screen.findByRole('heading', { name: 'Meal planner' });
      await act(async () => {});
      expect(tray()).toBeNull();
    });

    it('describes each suggestion with the examples it was made from', async () => {
      suggestions = [weekend];
      renderPage();
      const add = await screen.findByRole('button', { name: 'Add the suggested tag weekend' });
      const reason = document.getElementById(add.getAttribute('aria-describedby') ?? '');
      expect(reason?.textContent).toContain('these nuggets tagged weekend');
      expect(reason?.textContent).toContain('Bike shed');
      expect(reason?.textContent).toContain('Picnic map');
    });

    it('clicking a suggestion saves the current tags plus the suggested one', async () => {
      suggestions = [cooking];
      renderPage();
      await screen.findByRole('group', { name: 'Suggested tags' });
      // The server has gained a tag since the page loaded; Add must keep it.
      current = { ...current, tags: ['home', 'kitchen'] };

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Add the suggested tag cooking' }));
      });

      expect(calls('PATCH', '/api/ideas/1')).toEqual([{ tags: ['home', 'kitchen', 'cooking'] }]);
      expect(tray()).toBeNull();
      expect(await screen.findByRole('link', { name: 'cooking' })).toBeTruthy();
    });

    it('× calls the dismiss endpoint and removes the chip', async () => {
      suggestions = [cooking, weekend];
      renderPage();
      await screen.findByRole('group', { name: 'Suggested tags' });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss the suggested tag weekend' }));
      });

      expect(calls('POST', '/api/ideas/1/tag-suggestions/weekend/dismiss')).toHaveLength(1);
      expect(screen.queryByRole('button', { name: 'Dismiss the suggested tag weekend' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Dismiss the suggested tag cooking' })).toBeTruthy();
    });

    it('refetches when suggestions change in the background', async () => {
      renderPage();
      await screen.findByRole('heading', { name: 'Meal planner' });
      expect(tray()).toBeNull();

      suggestions = [cooking];
      await FakeEventSource.latest!.emit('tag-suggestions-changed');
      expect(await screen.findByRole('group', { name: 'Suggested tags' })).toBeTruthy();

      suggestions = [];
      await FakeEventSource.latest!.emit('ideas-changed');
      expect(tray()).toBeNull();
    });
  });
});
