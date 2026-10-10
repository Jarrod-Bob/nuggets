// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Idea } from '../../api';
import { LiveUpdatesProvider } from '../../live/LiveUpdates';
import { BankRoute } from '../../pages/BankRoute';
import { TagsProvider } from '../../tags/TagsProvider';

/**
 * The Comic bank, through BankRoute (the seam the Classic bank is tested at).
 * BankRoute.test.tsx runs the shared behaviour under both Looks; this holds
 * what only the Comic tray draws.
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

const nugget = (id: number, title: string, extra: Partial<Idea> = {}): Idea => ({
  id,
  title,
  notes: '',
  project_name: '',
  tags: [],
  status: 'raw',
  links: [],
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  archived_at: null,
  source: null,
  source_ref: null,
  origin: null,
  ...extra,
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('the bank under the Comic look', () => {
  let bank: Idea[];
  let listStatus: number;
  let requested: string[];

  beforeEach(() => {
    document.documentElement.dataset.look = 'comic';
    bank = [nugget(1, 'Named idea', { project_name: 'Ideanori', tags: ['saas'] }), nugget(2, 'Plain idea', { status: 'done' })];
    listStatus = 200;
    requested = [];
    vi.stubGlobal('EventSource', QuietEventSource);
    vi.stubGlobal(
      'fetch',
      vi.fn((path: string) => {
        requested.push(path);
        const url = new URL(path, 'http://nuggets.test');
        if (url.pathname === '/api/ideas/random') return Promise.resolve(json({ ...bank[1], notes: 'Worth a look.' }));
        if (url.pathname === '/api/ideas') return Promise.resolve(listStatus === 200 ? json(bank) : json({ error: { message: 'the bank is closed' } }, listStatus));
        if (url.pathname === '/api/tags') return Promise.resolve(json([{ name: 'saas', count: 1 }]));
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
    const loc = useLocation();
    return <p data-testid="where">{loc.pathname}</p>;
  }
  const renderBank = () =>
    render(
      <LiveUpdatesProvider>
        <TagsProvider>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route path="/" element={<BankRoute />} />
              <Route path="/nuggets/:id" element={<Where />} />
            </Routes>
          </MemoryRouter>
        </TagsProvider>
      </LiveUpdatesProvider>,
    );

  it('lays the bank out as a tray of nugget cards that open the nugget', async () => {
    renderBank();
    fireEvent.click(await screen.findByRole('button', { name: /Plain idea/ }));
    expect((await screen.findByTestId('where')).textContent).toBe('/nuggets/2');
  });

  it('shows a card its tags with a hash, and a named card its status and age', async () => {
    renderBank();
    await screen.findByText('#saas', { selector: '.comic-card-tags' });
    expect(screen.getByText(/^Raw · /)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Project name: Ideanori' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Project name: .*Plain/ })).toBeNull();
  });

  it('narrows the tray by status and by tag from the chips', async () => {
    renderBank();
    await screen.findByRole('button', { name: /Named idea/ });
    const status = screen.getByRole('group', { name: 'Filter by status' });
    fireEvent.click(within(status).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(requested.some((p) => p.includes('status=done'))).toBe(true));
    expect(within(status).getByRole('button', { name: 'Done' }).getAttribute('aria-pressed')).toBe('true');

    const tags = screen.getByRole('group', { name: 'Filter by tag' });
    fireEvent.click(within(tags).getByRole('button', { name: '#saas' }));
    await waitFor(() => expect(requested.some((p) => p.includes('tag=saas'))).toBe(true));
  });

  it('deals a drawn nugget as a card stamped PICK ME', async () => {
    renderBank();
    await waitFor(() => expect((screen.getByText('Draw a nugget').closest('button') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByText('Draw a nugget'));
    const dialog = await screen.findByRole('dialog', { name: 'Your challenge' });
    expect(within(dialog).getByText('PICK ME')).toBeTruthy();
    expect(within(dialog).getByText('Worth a look.')).toBeTruthy();
  });

  it('says so, in the narrator\'s voice, when the bank is empty', async () => {
    bank = [];
    renderBank();
    expect(await screen.findByText('Nothing in the bank yet')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Drop a nugget' }).length).toBeGreaterThan(0);
  });

  it('shows an error in plain words and lets it be dismissed', async () => {
    listStatus = 500;
    renderBank();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('the bank is closed');
    fireEvent.click(within(alert).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
