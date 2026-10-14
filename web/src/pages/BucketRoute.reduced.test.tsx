// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Idea } from '../api';
import { LiveUpdatesProvider } from '../live/LiveUpdates';
import { TagsProvider } from '../tags/TagsProvider';
import { BucketRoute } from './BucketRoute';

// Motion reads the reduced-motion preference once per process and keeps it,
// so the person who asked for no movement gets a file of their own.
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: query.includes('prefers-reduced-motion'),
  media: query,
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent: () => false,
}));

let emitIdeasChanged = () => {};
class TestEventSource {
  static readonly CLOSED = 2;
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  addEventListener(name: string, fn: () => void) {
    if (name === 'ideas-changed') emitIdeasChanged = () => act(fn);
  }
  close() {
    this.readyState = TestEventSource.CLOSED;
  }
}

const nugget = (id: number): Idea => ({
  id,
  title: `Nugget ${id}`,
  notes: '',
  project_name: '',
  tags: [],
  status: 'raw',
  links: [],
  created_at: new Date(Date.UTC(2026, 8, 1, 0, 0, id)).toISOString(),
  updated_at: '2026-09-01T00:00:00Z',
  archived_at: null,
  source: null,
  source_ref: null,
  origin: null,
});

let bank: Idea[];

beforeEach(() => {
  document.documentElement.dataset.look = 'comic';
  bank = [nugget(1), nugget(2)];
  vi.stubGlobal('EventSource', TestEventSource);
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string) => Promise.resolve(new Response(JSON.stringify(path === '/api/ideas' ? bank : []), { status: 200 }))),
  );
});
afterEach(() => {
  cleanup();
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

it('just updates the number and the pile, with nothing dropping in', async () => {
  renderBucket();
  await waitFor(() => expect(pile()).toHaveLength(2));
  bank = [...bank, nugget(3), nugget(4), nugget(5)];
  emitIdeasChanged();
  await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Till date, 5 nuggets have gone in the bucket:'));
  // In the same moment, not one after another.
  expect(pile()).toHaveLength(5);
});

it('goes straight to the bank when the bucket is clicked: no tip, no TIP!, no spill', async () => {
  renderBucket();
  await waitFor(() => expect(pile()).toHaveLength(2));
  fireEvent.click(screen.getByRole('button', { name: 'Tip the bucket and spill the nuggets' }));
  expect(screen.getByText('the bank')).toBeTruthy();
  expect(screen.queryByText('TIP!')).toBeNull();
});
