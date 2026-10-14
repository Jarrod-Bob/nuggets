// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';

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

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

const renderApp = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.stubGlobal('EventSource', QuietEventSource);
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(json([]))),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.look;
});

describe('the Comic shell', () => {
  beforeEach(() => {
    document.documentElement.dataset.look = 'comic';
  });

  it('puts a wordmark that links to the bank in the top bar, and the page controls beside it', async () => {
    renderApp('/');
    const link = await screen.findByRole('link', { name: 'nuggets' });
    const bar = screen.getByRole('banner');
    expect(within(bar).getByRole('link', { name: 'nuggets' })).toBe(link);
    expect(link.getAttribute('href')).toBe('/');
    expect(within(bar).getByPlaceholderText('Search your nuggets…')).toBeTruthy();
    expect(within(bar).getByRole('button', { name: 'Drop a nugget' })).toBeTruthy();
  });

  it('draws the same top bar on the trash page', async () => {
    renderApp('/trash');
    const link = await screen.findByRole('link', { name: 'nuggets' });
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'nuggets' })).toBe(link);
  });

  it('has a bucket button in the top bar that opens the bucket', async () => {
    renderApp('/');
    const bar = await screen.findByRole('banner');
    const bucket = within(bar).getByRole('link', { name: 'The bucket' });
    expect(bucket.getAttribute('href')).toBe('/bucket');
    fireEvent.click(bucket);
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Till date, 0 nuggets have gone in the bucket:');
    // Still in the bar on the bucket page, marked as where we are.
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'The bucket' }).getAttribute('aria-current')).toBe('page');
  });
});

describe('the Classic shell', () => {
  beforeEach(() => {
    document.documentElement.dataset.look = 'classic';
  });

  it('has no bucket, and sends /bucket to the bank', async () => {
    renderApp('/bucket');
    expect(await screen.findByPlaceholderText(/Search/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'The bucket' })).toBeNull();
    expect(screen.queryByRole('heading', { name: /Till date/ })).toBeNull();
  });
});
