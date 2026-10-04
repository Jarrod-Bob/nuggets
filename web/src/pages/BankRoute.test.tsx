// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
