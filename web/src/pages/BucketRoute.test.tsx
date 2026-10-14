// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Idea, Status } from '../api';
import { LiveUpdatesProvider } from '../live/LiveUpdates';
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

/** Nugget `id`, created `id` seconds into the day, so a higher id is newer. */
const nugget = (id: number, status: Status = 'raw', binned = false): Idea => ({
  id,
  title: `Nugget ${id}`,
  notes: '',
  project_name: '',
  tags: [],
  status,
  links: [],
  created_at: new Date(Date.UTC(2026, 8, 1, 0, 0, id)).toISOString(),
  updated_at: '2026-09-01T00:00:00Z',
  archived_at: binned ? '2026-09-02T00:00:00Z' : null,
  source: null,
  source_ref: null,
  origin: null,
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** What the fake server holds: the bank and the bin. */
let bank: Idea[];
let bin: Idea[];

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

/** The nuggets drawn in the bucket. */
const pile = () => within(screen.getByRole('list', { name: 'The pile' })).queryAllByRole('listitem');
const pileTitles = () => pile().map((li) => li.getAttribute('title'));
/** Long enough for a few arrivals to drop in one after another. */
const DROPS = { timeout: 4000 };

const sleep = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

const headline = async () => (await screen.findByRole('heading', { level: 1 })).textContent;

it('sends the Classic look back to the bank', async () => {
  document.documentElement.dataset.look = 'classic';
  bank = [nugget(1)];
  renderBucket();
  expect(await screen.findByText('the bank')).toBeTruthy();
});

describe('the bucket, in the Comic look', () => {
  beforeEach(() => {
    document.documentElement.dataset.look = 'comic';
  });

  it('counts every nugget that still exists, the bin included', async () => {
    bank = [nugget(1), nugget(2), nugget(3)];
    bin = [nugget(4, 'raw', true), nugget(5, 'raw', true)];
    renderBucket();
    expect(await headline()).toBe('Till date, 5 nuggets have gone in the bucket:');
  });

  it('says "nugget has" for one', async () => {
    bin = [nugget(1, 'raw', true)];
    renderBucket();
    expect(await headline()).toBe('Till date, 1 nugget has gone in the bucket:');
  });

  it('writes the count on the bucket itself, with a line per status and the bin, leaving out the empty ones', async () => {
    bank = [nugget(1, 'raw'), nugget(2, 'done'), nugget(3, 'building'), nugget(4, 'done'), nugget(5, 'parked'), nugget(6, 'killed'), nugget(7, 'exploring')];
    bin = [nugget(8, 'done', true), nugget(9, 'raw', true)];
    renderBucket();
    const bucket = await screen.findByRole('figure', { name: 'The bucket' });
    expect(within(bucket).getByRole('heading', { level: 1 }).textContent).toBe('Till date, 9 nuggets have gone in the bucket:');
    const lines = within(within(bucket).getByRole('list', { name: 'How they’re doing' }))
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(lines).toEqual(['2 fried crispy golden', '1 left to rot', '1 sizzling in the fryer', '1 getting breaded', '1 still raw', '1 in the freezer', '2 in the bin']);
  });

  it('hides a line whose count is zero', async () => {
    bank = [nugget(1, 'done'), nugget(2, 'raw')];
    renderBucket();
    const stats = await screen.findByRole('list', { name: 'How they’re doing' });
    expect(within(stats).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['1 fried crispy golden', '1 still raw']);
  });

  it('heaps the 30 newest in the bucket, already there on load, each named only on hover', async () => {
    bank = Array.from({ length: 33 }, (_, i) => nugget(i + 1));
    bin = [nugget(34, 'raw', true)];
    renderBucket();
    const bucket = await screen.findByRole('figure', { name: 'The bucket' });
    const heap = within(bucket).getByRole('list', { name: 'The pile' });
    expect(within(heap).getAllByRole('listitem')).toHaveLength(30);
    expect(pileTitles()).toContain('Nugget 34');
    expect(pileTitles()).toContain('Nugget 5');
    expect(pileTitles()).not.toContain('Nugget 4');
    // Unnamed: the title is a hover, not text on the nugget.
    expect(within(heap).queryByText('Nugget 34')).toBeNull();
  });

  it('drops new arrivals in one at a time, after the number has already gone up', async () => {
    bank = [nugget(1), nugget(2)];
    renderBucket();
    await waitFor(() => expect(pile()).toHaveLength(2));

    bank = [...bank, nugget(3), nugget(4), nugget(5)];
    TestEventSource.last!.emit('ideas-changed');
    await waitFor(async () => expect(await headline()).toBe('Till date, 5 nuggets have gone in the bucket:'));
    expect(pile().length).toBeLessThan(5);
    await waitFor(() => expect(pile().length).toBe(4), DROPS);
    await waitFor(() => expect(pileTitles()).toEqual(expect.arrayContaining(['Nugget 3', 'Nugget 4', 'Nugget 5'])), DROPS);
  });

  it('lets the oldest drawn nugget quietly leave once the pile is past 30', async () => {
    bank = Array.from({ length: 30 }, (_, i) => nugget(i + 1));
    renderBucket();
    await waitFor(() => expect(pile()).toHaveLength(30));

    bank = [...bank, nugget(31)];
    TestEventSource.last!.emit('ideas-changed');
    await waitFor(() => expect(pileTitles()).toContain('Nugget 31'), DROPS);
    await waitFor(() => expect(pileTitles()).not.toContain('Nugget 1'), DROPS);
    expect(pile()).toHaveLength(30);
    // Still counted: it only left the pile.
    expect(await headline()).toBe('Till date, 31 nuggets have gone in the bucket:');
  });

  it('takes a purged nugget out at once, without waiting for arrivals to drop', async () => {
    bank = [nugget(1), nugget(2)];
    bin = [nugget(3, 'raw', true)];
    renderBucket();
    await waitFor(() => expect(pile()).toHaveLength(3));

    bin = [];
    bank = [...bank, nugget(4), nugget(5), nugget(6), nugget(7)];
    TestEventSource.last!.emit('ideas-changed');
    await waitFor(() => expect(pileTitles()).not.toContain('Nugget 3'), { timeout: 300 });
    expect(pileTitles()).not.toContain('Nugget 7');
    expect(await headline()).toBe('Till date, 6 nuggets have gone in the bucket:');
  });

  it('puts an older nugget that a purge lets back into the newest 30 straight in, without dropping it like an arrival', async () => {
    bank = Array.from({ length: 31 }, (_, i) => nugget(i + 1));
    renderBucket();
    await waitFor(() => expect(pile()).toHaveLength(30));
    expect(pileTitles()).not.toContain('Nugget 1');

    bank = [...bank.filter((n) => n.id !== 20 && n.id !== 21), nugget(32)];
    TestEventSource.last!.emit('ideas-changed');
    // In the same moment as the count; only Nugget 32 is new.
    await waitFor(async () => expect(await headline()).toBe('Till date, 30 nuggets have gone in the bucket:'));
    expect(pileTitles()).toContain('Nugget 1');
    await waitFor(() => expect(pileTitles()).toContain('Nugget 32'), DROPS);
    expect(pile()).toHaveLength(30);
  });

  it('draws an edited nugget in place', async () => {
    bank = [nugget(1)];
    renderBucket();
    await waitFor(() => expect(pileTitles()).toEqual(['Nugget 1']));
    bank = [{ ...nugget(1), title: 'Renamed' }];
    TestEventSource.last!.emit('ideas-changed');
    await waitFor(() => expect(pileTitles()).toEqual(['Renamed']));
  });

  it('tips only from the bucket itself: a TIP!, the spill rests on the liner, then the bank', async () => {
    bank = [nugget(1), nugget(2)];
    renderBucket();
    await waitFor(() => expect(pile()).toHaveLength(2));
    const tippers = screen.getAllByRole('button', { name: /tip/i });
    expect(tippers).toHaveLength(1);
    expect(within(screen.getByRole('figure', { name: 'The bucket' })).getByRole('button', { name: 'Tip the bucket and spill the nuggets' })).toBe(tippers[0]);
    expect(screen.queryByText('TIP!')).toBeNull();

    fireEvent.click(tippers[0]);
    expect(screen.getByText('TIP!')).toBeTruthy();
    // The bucket tips, the nuggets pour out and land, and rest there a while.
    await sleep(2200);
    expect(screen.queryByText('the bank')).toBeNull();
    expect(await screen.findByText('the bank', {}, { timeout: 3000 })).toBeTruthy();
  }, 10000);

  it('does nothing when a nugget in the pile is clicked', async () => {
    bank = [nugget(1)];
    renderBucket();
    await waitFor(() => expect(pile()).toHaveLength(1));
    fireEvent.click(screen.getByTitle('Nugget 1'));
    expect(screen.queryByText('TIP!')).toBeNull();
    await sleep(1500);
    expect(screen.queryByText('the bank')).toBeNull();
  });

  it("says the bucket wouldn't load, and on Try again shows the pile already in place", async () => {
    bank = [nugget(1), nugget(2), nugget(3)];
    let down = true;
    vi.stubGlobal(
      'fetch',
      vi.fn((path: string) => {
        if (down) return Promise.resolve(json({ error: 'database is locked' }, 500));
        return Promise.resolve(json(path === '/api/ideas' ? bank : bin));
      }),
    );
    renderBucket();
    expect(await screen.findByText("The bucket wouldn't load")).toBeTruthy();
    expect(screen.queryByRole('figure', { name: 'The bucket' })).toBeNull();

    down = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await headline()).toBe('Till date, 3 nuggets have gone in the bucket:');
    // Already there, not dropping in one by one.
    expect(pile()).toHaveLength(3);
    expect(screen.queryByText("The bucket wouldn't load")).toBeNull();
  });
});
