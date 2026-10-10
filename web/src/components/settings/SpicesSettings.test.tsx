// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveUpdatesProvider } from '../../live/LiveUpdates';
import { SpicesSettings } from './SpicesSettings';
import { SpicesSettings as ComicSpicesSettings } from '../../looks/comic/settings/SpicesSettings';
import type { SpicesStatus } from '../../api';

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

const disconnected: SpicesStatus = { connected: false, url: 'http://localhost:8090', interval_seconds: 60, needs_resync: false };

let status: SpicesStatus;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  status = disconnected;
  vi.stubGlobal('EventSource', QuietEventSource);
  fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (path === '/api/settings/spices' && method === 'PUT') {
      const body = JSON.parse(String(init?.body));
      status = { ...status, connected: true, url: body.url, interval_seconds: body.interval_seconds };
      return json(status);
    }
    if (path === '/api/settings/spices' && method === 'DELETE') {
      status = { ...status, connected: false };
      return new Response(null, { status: 204 });
    }
    if (path === '/api/settings/spices') return json(status);
    if (path === '/api/spices/resync' && method === 'POST') {
      status = { ...status, needs_resync: false };
      return json({ ...status, detached: 3 });
    }
    return json({ error: { message: 'unexpected' } }, 500);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The section under test: Classic's, or the Comic look's drawing of it (same model, same accessible names). */
let Section: typeof SpicesSettings = SpicesSettings;

const renderSection = () =>
  render(
    <LiveUpdatesProvider>
      <Section open />
    </LiveUpdatesProvider>,
  );

const calls = (method: string, path: string) =>
  fetchMock.mock.calls.filter(([p, init]) => p === path && ((init as RequestInit | undefined)?.method ?? 'GET') === method);

describe.each([
  ['classic', SpicesSettings],
  ['comic', ComicSpicesSettings],
] as const)('spices settings under the %s look', (_look, Impl) => {
  beforeEach(() => {
    Section = Impl;
  });

  it('connects once a token is pasted in', async () => {
    renderSection();
    const connect = await screen.findByRole('button', { name: 'Connect' });
    expect((connect as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('API token'), { target: { value: 'secret' } });
    fireEvent.click(connect);

    expect(await screen.findByText('Connected')).toBeTruthy();
    const [[, init]] = calls('PUT', '/api/settings/spices');
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ url: 'http://localhost:8090', token: 'secret', interval_seconds: 60 });
  });

  it('turns down an interval that is not a whole number of seconds', async () => {
    renderSection();
    await screen.findByRole('button', { name: 'Connect' });
    fireEvent.change(screen.getByLabelText('API token'), { target: { value: 'secret' } });
    fireEvent.change(screen.getByLabelText('Sync every (seconds)'), { target: { value: '1.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    expect(await screen.findByText('The sync interval needs to be a whole number of seconds.')).toBeTruthy();
    expect(calls('PUT', '/api/settings/spices')).toHaveLength(0);
  });

  it('disconnects', async () => {
    status = { ...disconnected, connected: true };
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
    expect(await screen.findByRole('button', { name: 'Connect' })).toBeTruthy();
  });

  it('asks before a re-sync, then says how many nuggets were set aside', async () => {
    status = { ...disconnected, connected: true, needs_resync: true };
    renderSection();
    expect(await screen.findByText('Needs re-sync')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Re-sync' }));
    expect(screen.getByRole('button', { name: 'Not yet' })).toBeTruthy();
    expect(calls('POST', '/api/spices/resync')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Re-sync' }));
    expect(await screen.findByText(/3 nuggets from the old spices kept/)).toBeTruthy();
    expect(screen.getByText('Connected')).toBeTruthy();
  });
});
