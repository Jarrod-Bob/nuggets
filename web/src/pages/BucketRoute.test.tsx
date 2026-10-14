// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Idea, Status } from '../api';
import { LiveUpdatesProvider } from '../live/LiveUpdates';
import { DROP_MS } from '../looks/comic/BucketView';
import { TagsProvider } from '../tags/TagsProvider';
import { BucketRoute } from './BucketRoute';

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

const nugget = (id: number, status: Status = 'raw', archived = false): Idea => ({
  id,
  title: `Nugget ${id}`,
  notes: '',
  project_name: '',
  tags: [],
  status,
  links: [],
  created_at: `2026-09-01T00:${String(Math.floor(id / 60)).padStart(2, '0')}:${String(id % 60).padStart(2, '0')}Z`,
  updated_at: '2026-09-01T00:00:00Z',
  archived_at: archived ? '2026-09-02T00:00:00Z' : null,
  source: null,
  source_ref: null,
  origin: null,
});

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe('the bucket', () => {
  /** What the fake server holds: the bank, and the bin. */
  let bank: Idea[];
  let bin: Idea[];

  const setLook = (look: string) => {
    document.documentElement.dataset.look = look;
  };
  beforeEach(() => {
    bank = [];
    bin = [];
    vi.stubGlobal('EventSource', TestEventSource);
    vi.stubGlobal(
      'fetch',
      vi.fn((path: string) => {
        if (path === '/api/ideas') return Promise.resolve(json(bank));
        if (path === '/api/ideas?archived=true') return Promise.resolve(json(bin));
        return Promise.resolve(json([]));
      }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.look;
  });

  const renderBucket = () =>
    render(
      <LiveUpdatesProvider>
        <TagsProvider>
          <MemoryRouter initialEntries={['/bucket']}>
            <Routes>
              <Route path="/bucket" element={<BucketRoute />} />
              <Route path="/" element={<p>the bank</p>} />
            </Routes>
          </MemoryRouter>
        </TagsProvider>
      </LiveUpdatesProvider>,
    );

  const pile = () => within(screen.getByRole('list', { name: 'The pile' })).queryAllByRole('listitem');
  const headline = () => screen.getByRole('heading', { level: 1 }).textContent;

  it('sends Classic back to the bank', async () => {
    setLook('classic');
    renderBucket();
    expect(await screen.findByText('the bank')).toBeTruthy();
  });

  describe('in the Comic look', () => {
    beforeEach(() => setLook('comic'));

    it('counts every nugget that still exists, the bin included', async () => {
      bank = [nugget(1), nugget(2), nugget(3)];
      bin = [nugget(4, 'raw', true), nugget(5, 'raw', true)];
      renderBucket();
      await screen.findByRole('heading', { level: 1 });
      expect(headline()).toBe('Till date, 5 nuggets have gone in the bucket:');
    });

    it('says "nugget" for one', async () => {
      bank = [nugget(1)];
      renderBucket();
      await screen.findByRole('heading', { level: 1 });
      expect(headline()).toBe('Till date, 1 nugget has gone in the bucket:');
    });

    it('lists a line per status and the bin, and leaves out the empty ones', async () => {
      bank = [nugget(1, 'done'), nugget(2, 'done'), nugget(3, 'done'), nugget(4, 'killed'), nugget(5, 'raw')];
      bin = [nugget(6, 'raw', true), nugget(7, 'raw', true)];
      renderBucket();
      const stats = await screen.findByRole('list', { name: 'Nugget counts' });
      const lines = within(stats)
        .getAllByRole('listitem')
        .map((li) => li.textContent);
      expect(lines).toEqual(['3 fried crispy golden', '1 left to rot', '1 still raw', '2 in the bin']);
    });

    it('draws the pile already there on load, newest 30 only, each nugget showing its title on hover', async () => {
      bank = Array.from({ length: 35 }, (_, i) => nugget(i + 1));
      renderBucket();
      await waitFor(() => expect(pile()).toHaveLength(30));
      expect(screen.getByTitle('Nugget 35')).toBeTruthy();
      expect(screen.getByTitle('Nugget 6')).toBeTruthy();
      expect(screen.queryByTitle('Nugget 5')).toBeNull();
    });

    it('updates the number when something arrives, and drops the new nuggets in one after another', async () => {
      bank = [nugget(1), nugget(2)];
      renderBucket();
      await waitFor(() => expect(pile()).toHaveLength(2));

      bank = [...bank, nugget(3), nugget(4), nugget(5)];
      TestEventSource.last!.emit('ideas-changed');
      await waitFor(() => expect(headline()).toBe('Till date, 5 nuggets have gone in the bucket:'));
      // The number is already up; the pile is still catching up.
      expect(pile().length).toBeLessThan(5);
      await waitFor(() => expect(pile()).toHaveLength(5), { timeout: DROP_MS * 6 });
    });

    it('lets the oldest drawn nugget leave once the pile is past 30', async () => {
      bank = Array.from({ length: 30 }, (_, i) => nugget(i + 1));
      renderBucket();
      await waitFor(() => expect(pile()).toHaveLength(30));

      bank = [...bank, nugget(31)];
      TestEventSource.last!.emit('ideas-changed');
      await waitFor(() => expect(screen.queryByTitle('Nugget 1')).toBeNull(), { timeout: DROP_MS * 4 });
      expect(screen.getByTitle('Nugget 31')).toBeTruthy();
      expect(pile()).toHaveLength(30);
    });

    it('takes a purged nugget out of the pile and the count', async () => {
      bank = [nugget(1)];
      bin = [nugget(2, 'raw', true)];
      renderBucket();
      await waitFor(() => expect(pile()).toHaveLength(2));

      bin = [];
      TestEventSource.last!.emit('ideas-changed');
      await waitFor(() => expect(headline()).toBe('Till date, 1 nugget has gone in the bucket:'));
      await waitFor(() => expect(pile()).toHaveLength(1));
    });

    it('writes the count and the stats on the bucket itself, with no separate tip button', async () => {
      bank = [nugget(1, 'done')];
      renderBucket();
      const bucketFigure = await screen.findByRole('figure', { name: 'The bucket' });
      expect(within(bucketFigure).getByRole('heading', { level: 1 }).textContent).toBe('Till date, 1 nugget has gone in the bucket:');
      expect(within(bucketFigure).getByRole('list', { name: 'Nugget counts' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Tip the bucket' })).toBeNull();
    });

    it('tips when the bucket is clicked: a TIP!, the spill lands on the mat and rests, then the bank', async () => {
      bank = [nugget(1)];
      renderBucket();
      await waitFor(() => expect(pile()).toHaveLength(1));
      expect(screen.queryByText('TIP!')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Tip the bucket and spill the nuggets' }));
      expect(screen.getByText('TIP!')).toBeTruthy();
      // The spill lands and rests before the bank.
      await new Promise((r) => setTimeout(r, 2000));
      expect(screen.queryByText('the bank')).toBeNull();
      expect(await screen.findByText('the bank', {}, { timeout: 3000 })).toBeTruthy();
    });

    it("doesn't tip when a nugget in the pile is clicked", async () => {
      bank = [nugget(1)];
      renderBucket();
      await waitFor(() => expect(pile()).toHaveLength(1));
      fireEvent.click(screen.getByTitle('Nugget 1'));
      expect(screen.queryByText('TIP!')).toBeNull();
      await new Promise((r) => setTimeout(r, 1500));
      expect(screen.queryByText('the bank')).toBeNull();
    });

    it('says so when the bucket fails to load, and loads on Try again without pouring the pile in', async () => {
      bank = [nugget(1), nugget(2)];
      let down = true;
      vi.stubGlobal(
        'fetch',
        vi.fn((path: string) => {
          if (down) return Promise.resolve(new Response(JSON.stringify({ error: 'The bank is closed.' }), { status: 500 }));
          if (path === '/api/ideas') return Promise.resolve(json(bank));
          return Promise.resolve(json(bin));
        }),
      );
      renderBucket();
      expect(await screen.findByText("The bucket wouldn't load")).toBeTruthy();

      down = false;
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await waitFor(() => expect(headline()).toBe('Till date, 2 nuggets have gone in the bucket:'));
      // Already there, not dropping in one by one.
      expect(pile()).toHaveLength(2);
    });
  });
});
