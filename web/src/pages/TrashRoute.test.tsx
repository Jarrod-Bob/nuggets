// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LOOKS } from '../looks/look';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveUpdatesProvider } from '../live/LiveUpdates';
import { TagsProvider } from '../tags/TagsProvider';
import { TrashRoute } from './TrashRoute';
import type { Idea } from '../api';

/** A stream the test can fire events on, like the server's GET /api/events. */
class TestEventSource {
  static readonly CLOSED = 2;
  static last: TestEventSource | null = null;
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, Array<() => void>>();
  constructor() {
    TestEventSource.last = this;
  }
  addEventListener(name: string, fn: () => void) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), fn]);
  }
  close() {
    this.readyState = TestEventSource.CLOSED;
  }
  emit(name: string) {
    act(() => {
      for (const fn of this.listeners.get(name) ?? []) fn();
    });
  }
}

const binned = (id: number, title: string): Idea => ({
  id,
  title,
  notes: '',
  project_name: '',
  tags: [],
  status: 'raw',
  links: [],
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  archived_at: '2026-09-02T00:00:00Z',
  source: null,
  source_ref: null,
  origin: null,
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe.each(LOOKS)('under the %s look', (look) => {
  beforeEach(() => {
    document.documentElement.dataset.look = look;
  });
  /** What's in the trash on the fake server. */
  let trash: Idea[];
  let calls: string[];

  beforeEach(() => {
    trash = [binned(1, 'First binned'), binned(2, 'Second binned')];
    calls = [];
    vi.stubGlobal('EventSource', TestEventSource);
    vi.stubGlobal(
      'fetch',
      vi.fn((path: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        calls.push(`${method} ${path}`);
        const restore = path.match(/^\/api\/ideas\/(\d+)\/restore$/);
        if (restore && method === 'POST') {
          trash = trash.filter((i) => i.id !== Number(restore[1]));
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        const purge = path.match(/^\/api\/ideas\/(\d+)$/);
        if (purge && method === 'DELETE') {
          trash = trash.filter((i) => i.id !== Number(purge[1]));
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        if (path === '/api/settings/look') return Promise.resolve(json({ look: 'comic' }));
        if (path === '/api/ideas?archived=true') return Promise.resolve(json(trash));
        return Promise.resolve(json([]));
      }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const renderTrash = () =>
    render(
      <LiveUpdatesProvider>
        <TagsProvider>
          <MemoryRouter initialEntries={['/trash']}>
            <TrashRoute />
          </MemoryRouter>
        </TagsProvider>
      </LiveUpdatesProvider>,
    );

  /** A button on the card of the binned nugget with this title. */
  const buttonIn = async (title: string, name: string) => {
    // Climb from the title until the card's own buttons are in reach.
    let el: HTMLElement | null = await screen.findByText(title);
    while (el && within(el).queryAllByRole('button', { name }).length === 0) el = el.parentElement;
    return within(el as HTMLElement).getAllByRole('button', { name })[0];
  };

  describe('the trash', () => {
    it("draws the bin in this Look's own view, not another's", async () => {
      renderTrash();
      await screen.findByText('First binned');
      // The Comic bin is the lazy view's marker; Classic must never show it.
      expect(document.querySelector('.comic-bin') !== null).toBe(look === 'comic');
    });

    it('says so when nothing has been binned', async () => {
      trash = [];
      renderTrash();
      expect(await screen.findByText('Trash is empty')).toBeTruthy();
    });

    it("opens Settings in this Look's own dialog", async () => {
      renderTrash();
      await screen.findByText('First binned');
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      await screen.findByRole('dialog', { name: 'Settings' });
      expect(document.querySelector('.comic-dialog') !== null).toBe(look === 'comic');
    });

    it('shows the binned nuggets', async () => {
      renderTrash();
      expect(await screen.findByText('First binned')).toBeTruthy();
      expect(screen.getByText('Second binned')).toBeTruthy();
    });

    it('puts a restored nugget back in the bank', async () => {
      renderTrash();
      fireEvent.click(await buttonIn('First binned', 'Restore'));
      await screen.findByText('Second binned');
      await vi.waitFor(() => expect(screen.queryByText('First binned')).toBeNull());
      expect(calls).toContain('POST /api/ideas/1/restore');
    });

    it('asks before purging, and keeps the nugget if you say keep it', async () => {
      renderTrash();
      fireEvent.click(await buttonIn('First binned', 'Purge'));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Purge this nugget?')).toBeTruthy();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Keep it' }));
      expect(calls.some((c) => c.startsWith('DELETE'))).toBe(false);
      expect(screen.getByText('First binned')).toBeTruthy();
    });

    it('purges for good once confirmed', async () => {
      renderTrash();
      fireEvent.click(await buttonIn('First binned', 'Purge'));
      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Purge' }));
      await vi.waitFor(() => expect(screen.queryByText('First binned')).toBeNull());
      expect(calls).toContain('DELETE /api/ideas/1');
    });

    it('picks up a nugget binned in the background', async () => {
      renderTrash();
      await screen.findByText('First binned');
      trash = [...trash, binned(3, 'Binned by spices')];
      TestEventSource.last?.emit('ideas-changed');
      expect(await screen.findByText('Binned by spices')).toBeTruthy();
    });
  });

  describe('when the page arrived without a look (the Vite dev server)', () => {
    beforeEach(() => {
      delete document.documentElement.dataset.look;
    });

    it('asks the server which look, and still shows the nuggets', async () => {
      renderTrash();
      expect(await screen.findByText('First binned')).toBeTruthy();
      await waitFor(() => expect(document.documentElement.dataset.look).toBe('comic'));
      expect(calls).toContain('GET /api/settings/look');
    });
  });
});
