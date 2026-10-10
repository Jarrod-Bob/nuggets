// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LookSettings } from './LookSettings';
import { LookSettings as ComicLookSettings } from '../../looks/comic/settings/LookSettings';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

let saved: string;
let puts: Array<{ look: string }>;
let failNext: boolean;

beforeEach(() => {
  saved = 'classic';
  puts = [];
  failNext = false;
  document.documentElement.dataset.look = 'classic';
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      if (path === '/api/settings/look' && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        puts.push(body);
        if (failNext) return json({ error: { message: 'Something went wrong saving that.' } }, 500);
        saved = body.look;
        return json({ look: saved });
      }
      if (path === '/api/settings/look') return json({ look: saved });
      return json({ error: { message: 'unexpected' } }, 500);
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.look;
});

const classic = () => screen.getByRole('radio', { name: 'Classic' }) as HTMLInputElement;
const comic = () => screen.getByRole('radio', { name: 'Comic (in progress)' }) as HTMLInputElement;

describe.each([
  ['classic', LookSettings],
  ['comic', ComicLookSettings],
] as const)('LookSettings under the %s look', (_look, Section) => {
  it('offers Classic, selected by default, and Comic (in progress)', async () => {
    render(<Section open />);
    await waitFor(() => expect(classic().checked).toBe(true));
    expect(comic().checked).toBe(false);
  });

  it('shows the saved look', async () => {
    saved = 'comic';
    render(<Section open />);
    await waitFor(() => expect(comic().checked).toBe(true));
  });

  it('saves Comic and switches the page to it straight away', async () => {
    render(<Section open />);
    await waitFor(() => expect(classic().checked).toBe(true));

    fireEvent.click(comic());

    await waitFor(() => expect(document.documentElement.dataset.look).toBe('comic'));
    expect(puts).toEqual([{ look: 'comic' }]);
    expect(comic().checked).toBe(true);
  });

  it('shows the error and keeps the old look when saving fails', async () => {
    render(<Section open />);
    await waitFor(() => expect(classic().checked).toBe(true));
    failNext = true;

    fireEvent.click(comic());

    expect(await screen.findByText('Something went wrong saving that.')).toBeTruthy();
    expect(classic().checked).toBe(true);
    expect(document.documentElement.dataset.look).toBe('classic');
  });
});
