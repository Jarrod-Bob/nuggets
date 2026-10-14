// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
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
});
