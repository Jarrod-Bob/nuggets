// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveUpdatesProvider } from '../../live/LiveUpdates';
import { TagSuggestionSettings } from './TagSuggestionSettings';
import type { TagSuggestionStatus } from '../../api';

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

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

let status: TagSuggestionStatus;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  status = { connected: false, pending: 0 };
  vi.stubGlobal('EventSource', QuietEventSource);
  fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/settings/jev' && init?.method === 'PUT') {
      status = { ...status, connected: true, last_error: undefined };
      return json(status);
    }
    if (path === '/api/settings/jev' && init?.method === 'DELETE') {
      status = { connected: false, pending: 0 };
      return new Response(null, { status: 204 });
    }
    if (path === '/api/settings/jev') return json(status);
    return json({ error: { message: 'unexpected' } }, 500);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderSection = () =>
  render(
    <LiveUpdatesProvider>
      <TagSuggestionSettings open />
    </LiveUpdatesProvider>,
  );

const putBodies = () =>
  fetchMock.mock.calls
    .filter(([path, init]) => path === '/api/settings/jev' && (init as RequestInit | undefined)?.method === 'PUT')
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)));

describe('TagSuggestionSettings', () => {
  it('names TypeSafe, links to its keys and asks for a key while not connected', async () => {
    renderSection();
    expect(await screen.findByRole('heading', { name: 'Tag suggestions' })).toBeTruthy();
    expect(await screen.findByText('Not connected')).toBeTruthy();
    const link = screen.getByRole('link', { name: /TypeSafe/ }) as HTMLAnchorElement;
    expect(link.href).toBe('https://console.typesafe.ai/keys');
    const key = screen.getByLabelText('TypeSafe API key') as HTMLInputElement;
    expect(key.type).toBe('password');
    expect(screen.queryByText(/waiting to be checked/)).toBeNull();
    expect(screen.queryByText(/Jev/)).toBeNull();
  });

  it('connects with a trimmed key and never shows it back', async () => {
    renderSection();
    await screen.findByText('Not connected');
    fireEvent.change(screen.getByLabelText('TypeSafe API key'), { target: { value: ' ts_abc ' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    });
    expect(putBodies()).toEqual([{ api_key: 'ts_abc' }]);
    expect(await screen.findByText('Connected')).toBeTruthy();
    expect(screen.queryByDisplayValue(/ts_abc/)).toBeNull();
  });

  it('shows the pending count and the last error while connected, and disconnects', async () => {
    status = { connected: true, pending: 4, last_error: 'TypeSafe rejected the API key. Check it and save it again.' };
    renderSection();
    expect(await screen.findByText('Connected')).toBeTruthy();
    expect(screen.getByText('4 nuggets waiting to be checked')).toBeTruthy();
    expect(screen.getByText(/TypeSafe rejected the API key/)).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    });
    expect(await screen.findByText('Not connected')).toBeTruthy();
    expect(screen.queryByText(/waiting to be checked/)).toBeNull();
  });

  it('says one nugget in the singular', async () => {
    status = { connected: true, pending: 1 };
    renderSection();
    expect(await screen.findByText('1 nugget waiting to be checked')).toBeTruthy();
  });
});
