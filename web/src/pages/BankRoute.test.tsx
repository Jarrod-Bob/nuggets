// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LOOKS } from '../looks/look';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveUpdatesProvider } from '../live/LiveUpdates';
import { TagsProvider } from '../tags/TagsProvider';
import { BankRoute } from './BankRoute';
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

const nugget = (id: number, title: string): Idea => ({
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
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe.each(LOOKS)('under the %s look', (look) => {
  beforeEach(() => {
    document.documentElement.dataset.look = look;
  });
  /** The drawable bank. The fake draw honours `exclude` the way the server does. */
  let bank: Idea[];

  beforeEach(() => {
    bank = [nugget(1, 'First idea'), nugget(2, 'Second idea')];
    vi.stubGlobal('EventSource', QuietEventSource);
    vi.stubGlobal(
      'fetch',
      vi.fn((path: string) => {
        const url = new URL(path, 'http://nuggets.test');
        if (url.pathname === '/api/ideas/random') {
          const exclude = Number(url.searchParams.get('exclude') ?? 0);
          return Promise.resolve(json(bank.find((i) => i.id !== exclude) ?? bank[0]));
        }
        if (url.pathname === '/api/ideas') return Promise.resolve(json(bank));
        return Promise.resolve(json([]));
      }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const renderBank = () =>
    render(
      <LiveUpdatesProvider>
        <TagsProvider>
          <MemoryRouter initialEntries={['/']}>
            <BankRoute />
          </MemoryRouter>
        </TagsProvider>
      </LiveUpdatesProvider>,
    );

  const drawnTitle = () => within(screen.getByRole('dialog')).getByRole('heading', { level: 3 }).textContent;
  const ready = (label: string) => waitFor(() => expect((screen.getByText(label).closest('button') as HTMLButtonElement).disabled).toBe(false));

  describe('BankRoute draw', () => {
    it('never rerolls the nugget onto the one already showing', async () => {
      renderBank();
      await ready('Draw a nugget');
      fireEvent.click(screen.getByText('Draw a nugget'));
      for (let n = 0; n < 4; n++) {
        await ready('Reroll nugget');
        const shown = drawnTitle();
        fireEvent.click(screen.getByText('Reroll nugget'));
        await ready('Reroll nugget');
        expect(drawnTitle()).not.toBe(shown);
      }
    });

    it('rerolls onto the same nugget when it is the only one', async () => {
      bank = [nugget(7, 'Lonely idea')];
      renderBank();
      await ready('Draw a nugget');
      fireEvent.click(screen.getByText('Draw a nugget'));
      await ready('Reroll nugget');
      fireEvent.click(screen.getByText('Reroll nugget'));
      await ready('Reroll nugget');
      expect(drawnTitle()).toBe('Lonely idea');
    });
  });

  describe('BankRoute edit', () => {
    const renderRoutes = () =>
      render(
        <LiveUpdatesProvider>
          <TagsProvider>
            <MemoryRouter initialEntries={['/']}>
              <Routes>
                <Route path="/" element={<BankRoute />} />
                <Route path="/nuggets/:id" element={<p>The nugget page</p>} />
              </Routes>
            </MemoryRouter>
          </TagsProvider>
        </LiveUpdatesProvider>,
      );

    it('edits in a dialog over the bank, and saving closes it without leaving the bank', async () => {
      const patches: { path: string; body: unknown }[] = [];
      const base = fetch as unknown as (path: string, init?: RequestInit) => Promise<Response>;
      vi.stubGlobal(
        'fetch',
        vi.fn((path: string, init?: RequestInit) => {
          if (init?.method === 'PATCH') {
            patches.push({ path, body: JSON.parse(String(init.body)) });
            return Promise.resolve(json({ ...bank[0], title: 'Renamed idea' }));
          }
          return base(path, init);
        }),
      );
      renderRoutes();
      await screen.findByText('First idea');

      fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      const dialog = await screen.findByRole('dialog');
      expect(screen.queryByText('The nugget page')).toBeNull();

      fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Renamed idea' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(patches).toHaveLength(1);
      expect(patches[0].path).toBe('/api/ideas/1');
      expect(patches[0].body).toMatchObject({ title: 'Renamed idea' });
      expect(screen.queryByText('The nugget page')).toBeNull();
      expect(screen.getByText('First idea')).toBeTruthy();
    });

    it('keeps unsaved edits when the list refetches behind the dialog', async () => {
      renderRoutes();
      await screen.findByText('First idea');
      fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      const dialog = await screen.findByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Half-typed' } });

      // A search change refetches the list, handing back fresh objects — the same
      // thing a background import does. The renamed row proves the refetch landed.
      bank = [nugget(1, 'Refetched idea'), nugget(2, 'Second idea')];
      fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'idea' } });
      await screen.findByText('Refetched idea');

      expect((within(screen.getByRole('dialog')).getByLabelText('Title') as HTMLInputElement).value).toBe('Half-typed');
    });

    it('keeps the dialog open and shows the error when the save fails', async () => {
      const base = fetch as unknown as (path: string, init?: RequestInit) => Promise<Response>;
      vi.stubGlobal(
        'fetch',
        vi.fn((path: string, init?: RequestInit) =>
          init?.method === 'PATCH' ? Promise.resolve(json({ error: { message: 'title is too long' } }, 400)) : base(path, init),
        ),
      );
      renderRoutes();
      await screen.findByText('First idea');
      fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      await within(dialog).findByText('title is too long');
      expect(screen.getByRole('dialog')).toBe(dialog);
      expect(screen.queryByText('The nugget page')).toBeNull();
    });
  });
});
