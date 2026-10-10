// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveUpdatesProvider } from '../../live/LiveUpdates';
import { GitHubSettings } from './GitHubSettings';
import { GitHubSettings as ComicGitHubSettings } from '../../looks/comic/settings/GitHubSettings';
import type { GitHubStatus } from '../../api';

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

const disconnected: GitHubStatus = {
  connected: false,
  mappings: [{ tag: 'nuggets', repo: 'Jarrod-Bob/nuggets' }],
  pending: 2,
  failed: 0,
};

let status: GitHubStatus;
/** What PUT /api/settings/github answers, given the request body. */
let onSave: (body: Record<string, unknown>) => Response;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  status = disconnected;
  onSave = (body) => {
    status = {
      ...status,
      connected: status.connected || typeof body.token === 'string',
      mappings: (body.mappings as GitHubStatus['mappings']) ?? status.mappings,
    };
    return json(status);
  };
  vi.stubGlobal('EventSource', QuietEventSource);
  fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/settings/github' && init?.method === 'PUT') return onSave(JSON.parse(String(init.body)));
    if (path === '/api/settings/github' && init?.method === 'DELETE') {
      status = { ...status, connected: false };
      return new Response(null, { status: 204 });
    }
    if (path === '/api/settings/github') return json(status);
    return json({ error: { message: 'unexpected' } }, 500);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The section under test: Classic's, or the Comic look's drawing of it (same model, same accessible names). */
let Section: typeof GitHubSettings = GitHubSettings;

const renderSection = () =>
  render(
    <LiveUpdatesProvider>
      <Section open />
    </LiveUpdatesProvider>,
  );

const putBodies = () =>
  fetchMock.mock.calls
    .filter(([path, init]) => path === '/api/settings/github' && (init as RequestInit | undefined)?.method === 'PUT')
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)));

describe.each([
  ['classic', GitHubSettings],
  ['comic', ComicGitHubSettings],
] as const)('GitHubSettings under the %s look', (_look, Impl) => {
  beforeEach(() => {
    Section = Impl;
  });

  it('explains the token scope and shows the queue while not connected', async () => {
    renderSection();
    expect(await screen.findByText('Not connected')).toBeTruthy();
    expect(screen.getByText(/Issues: Read and write/)).toBeTruthy();
    expect(screen.getByText('2 queued')).toBeTruthy();
    const token = screen.getByLabelText('Personal access token') as HTMLInputElement;
    expect(token.type).toBe('password');
    expect(token.value).toBe('');
    expect((screen.getByLabelText('Tag') as HTMLInputElement).value).toBe('nuggets');
    expect((screen.getByLabelText('Repository') as HTMLInputElement).value).toBe('Jarrod-Bob/nuggets');
  });

  it('connects with a token and the edited mapping', async () => {
    renderSection();
    await screen.findByText('Not connected');

    fireEvent.change(screen.getByLabelText('Personal access token'), { target: { value: ' github_pat_abc ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add a tag' }));
    fireEvent.change(document.getElementById('github-tag-1')!, { target: { value: 'spices' } });
    fireEvent.change(document.getElementById('github-repo-1')!, { target: { value: 'Jarrod-Bob/spices' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    });

    expect(putBodies()).toEqual([
      {
        token: 'github_pat_abc',
        mappings: [
          { tag: 'nuggets', repo: 'Jarrod-Bob/nuggets' },
          { tag: 'spices', repo: 'Jarrod-Bob/spices' },
        ],
      },
    ]);
    expect(await screen.findByText('Connected')).toBeTruthy();
    expect(screen.getByText('Jarrod-Bob/spices')).toBeTruthy();
    // The token is never shown back.
    expect(screen.queryByDisplayValue(/github_pat/)).toBeNull();
  });

  it('shows the server’s validation message and keeps the edits', async () => {
    onSave = () => json({ error: { message: '"nope" isn\'t a GitHub repository.' } }, 400);
    renderSection();
    await screen.findByText('Not connected');

    fireEvent.change(screen.getByLabelText('Repository'), { target: { value: 'nope' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    expect((await screen.findByRole('alert')).textContent).toContain("isn't a GitHub repository");
    expect((screen.getByLabelText('Repository') as HTMLInputElement).value).toBe('nope');
  });

  it('changes the mapping of a connected account without resending the token', async () => {
    status = { ...disconnected, connected: true, pending: 0, last_error: 'GitHub rejected the token.' };
    renderSection();
    expect(await screen.findByText('Connected')).toBeTruthy();
    expect(screen.getByText('GitHub rejected the token.')).toBeTruthy();
    expect(screen.queryByLabelText('Personal access token')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove the nuggets mapping' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    expect(putBodies()).toEqual([{ mappings: [] }]);
    expect(await screen.findByText(/No tags are mapped/)).toBeTruthy();
  });

  it('disconnects', async () => {
    status = { ...disconnected, connected: true };
    renderSection();
    await screen.findByText('Connected');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    });
    expect(await screen.findByText('Not connected')).toBeTruthy();
  });
});
