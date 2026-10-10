// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveUpdatesProvider } from '../../../live/LiveUpdates';
import { SettingsButton } from './SettingsButton';

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

beforeEach(() => {
  document.documentElement.dataset.look = 'comic';
  vi.stubGlobal('EventSource', QuietEventSource);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path === '/api/settings/spices') return json({ connected: false, url: 'http://localhost:8090', interval_seconds: 60, needs_resync: false });
      if (path === '/api/settings/github') return json({ connected: false, mappings: [], pending: 0, failed: 0 });
      if (path === '/api/settings/kimi') return json({ url: 'http://127.0.0.1:7799' });
      if (path === '/api/settings/jev') return json({ connected: false, pending: 0 });
      if (path === '/api/settings/look') return json({ look: 'comic' });
      return json({ error: { message: 'unexpected' } }, 500);
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.look;
});

const renderButton = () =>
  render(
    <LiveUpdatesProvider>
      <SettingsButton />
    </LiveUpdatesProvider>,
  );

describe('the Comic settings button', () => {
  it('opens a Settings dialog with the Look picker and a section per integration', async () => {
    renderButton();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    expect(within(dialog).getByRole('radiogroup', { name: 'Look' })).toBeTruthy();
    for (const name of ['spices', 'GitHub', 'kimi', 'Tag suggestions']) {
      expect(within(dialog).getByRole('heading', { name })).toBeTruthy();
    }
    await waitFor(() => expect((within(dialog).getByRole('radio', { name: 'Comic (in progress)' }) as HTMLInputElement).checked).toBe(true));
  });

  it('closes on Escape and on its close button', async () => {
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
