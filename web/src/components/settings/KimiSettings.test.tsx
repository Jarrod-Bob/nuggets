// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KimiSettings } from './KimiSettings';
import { KimiSettings as ComicKimiSettings } from '../../looks/comic/settings/KimiSettings';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

let saved: string;
let puts: Array<{ url: string }>;

beforeEach(() => {
  saved = 'http://127.0.0.1:7799';
  puts = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      if (path === '/api/settings/kimi' && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        puts.push(body);
        if (!body.url.startsWith('http')) return json({ error: { message: "kimi's address needs to be a full http or https URL." } }, 400);
        saved = body.url.replace(/\/+$/, '');
        return json({ url: saved });
      }
      if (path === '/api/settings/kimi') return json({ url: saved });
      return json({ error: { message: 'unexpected' } }, 500);
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const urlInput = () => screen.getByLabelText(/^kimi address/) as HTMLInputElement;

describe.each([
  ['classic', KimiSettings],
  ['comic', ComicKimiSettings],
] as const)('KimiSettings under the %s look', (_look, Section) => {
  it('shows the saved address and saves a new one', async () => {
    render(<Section open />);
    await waitFor(() => expect(urlInput().value).toBe('http://127.0.0.1:7799'));

    fireEvent.change(urlInput(), { target: { value: 'http://127.0.0.1:7800/' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(urlInput().value).toBe('http://127.0.0.1:7800'));
    expect(puts).toEqual([{ url: 'http://127.0.0.1:7800/' }]);
    expect(screen.getByText('Saved.')).toBeTruthy();
  });

  it("shows the server's message for a bad address", async () => {
    render(<Section open />);
    await waitFor(() => expect(urlInput().value).toBe('http://127.0.0.1:7799'));

    fireEvent.change(urlInput(), { target: { value: 'localhost:7799' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText("kimi's address needs to be a full http or https URL.")).toBeTruthy();
  });
});
