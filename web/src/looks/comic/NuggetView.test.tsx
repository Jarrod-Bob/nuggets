// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Idea } from '../../api';
import { LiveUpdatesProvider } from '../../live/LiveUpdates';
import { NuggetPage } from '../../pages/NuggetPage';
import { TagsProvider } from '../../tags/TagsProvider';

/**
 * A nugget's page under the Comic look, through NuggetPage (the seam Classic's
 * is tested at). NuggetPage.test.tsx and NuggetPage.tagSuggestions.test.tsx run
 * the shared behaviour under both Looks; this holds what only the Comic page
 * draws, and proves those runs really render the Comic view.
 */

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

const base: Idea = {
  id: 1,
  title: 'A loaded nugget',
  notes: 'Some notes.',
  project_name: '',
  tags: ['web'],
  status: 'building',
  links: [],
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-03T00:00:00Z',
  archived_at: null,
  source: null,
  source_ref: null,
  origin: null,
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("a nugget's page under the Comic look", () => {
  let current: Idea;
  let calls: Array<[string, string]>;

  beforeEach(() => {
    document.documentElement.dataset.look = 'comic';
    current = base;
    calls = [];
    vi.stubGlobal('EventSource', QuietEventSource);
    vi.stubGlobal(
      'fetch',
      vi.fn((path: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        calls.push([method, path]);
        if (path === '/api/tags') return Promise.resolve(json([]));
        if (path === '/api/ideas/1' && method === 'GET') return Promise.resolve(json(current));
        if (path === '/api/ideas/1/restore') {
          current = { ...current, archived_at: null };
          return Promise.resolve(json(current));
        }
        if (path === '/api/ideas/1/purge' || path === '/api/ideas/1') return Promise.resolve(new Response(null, { status: 204 }));
        return Promise.resolve(json([]));
      }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.look;
  });

  function Where() {
    return <p data-testid="where">{useLocation().pathname}</p>;
  }
  const renderPage = () =>
    render(
      <LiveUpdatesProvider>
        <TagsProvider>
          <MemoryRouter initialEntries={['/nuggets/1']}>
            <Routes>
              <Route path="/nuggets/:id" element={<NuggetPage />} />
              <Route path="/" element={<Where />} />
            </Routes>
          </MemoryRouter>
        </TagsProvider>
      </LiveUpdatesProvider>,
    );

  it('lays the nugget out in panels: title, status word, tags with a hash, notes and dates', async () => {
    renderPage();
    const page = await waitFor(() => {
      const el = document.querySelector('.comic-nugget');
      if (!el) throw new Error('not the Comic page yet');
      return el as HTMLElement;
    });
    expect(within(page).getByRole('heading', { level: 1, name: 'A loaded nugget' })).toBeTruthy();
    expect(within(page).getByText('Building', { selector: '.comic-status' })).toBeTruthy();
    // The tag shows with a hash but is named without it, as in Classic.
    expect(within(page).getByRole('link', { name: 'web' }).textContent).toBe('#web');
    expect(within(page).getByText('Some notes.')).toBeTruthy();
    expect(within(page).getByText(/^captured /)).toBeTruthy();
    expect(within(page).getByText(/last changed /)).toBeTruthy();
  });

  it('restores a nugget from the bin', async () => {
    current = { ...base, archived_at: '2026-09-04T00:00:00Z' };
    renderPage();
    expect(await screen.findByText('In the trash')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(screen.queryByText('In the trash')).toBeNull());
    expect(calls).toContainEqual(['POST', '/api/ideas/1/restore']);
  });

  it('asks before purging, in the Comic dialog, and Keep it backs out', async () => {
    renderPage();
    await waitFor(() => expect(document.querySelector('.comic-nugget')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Purge' }));
    const dialog = await screen.findByRole('dialog', { name: 'Purge this nugget?' });
    expect(dialog.className).toContain('comic-dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep it' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls.some(([m, p]) => m === 'DELETE' || p.endsWith('/purge'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Purge' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Purge' }));
    expect((await screen.findByTestId('where')).textContent).toBe('/');
  });

  it("says so in the narrator's voice when the nugget is not in the bank", async () => {
    vi.mocked(fetch).mockImplementation(() => Promise.resolve(json({ error: { message: 'idea not found' } }, 404)));
    renderPage();
    const note = await screen.findByText('Not in the bank');
    expect(note.closest('.comic-caption')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Back to the bank' }).length).toBeGreaterThan(0);
  });
});
