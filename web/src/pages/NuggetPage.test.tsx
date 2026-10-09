// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveUpdatesProvider } from '../live/LiveUpdates';
import { TagsProvider } from '../tags/TagsProvider';
import { NuggetPage } from './NuggetPage';
import type { FeatureRequest, Idea } from '../api';

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

const idea: Idea = {
  id: 1,
  title: 'A loaded nugget',
  notes: '',
  project_name: '',
  tags: [],
  status: 'raw',
  links: [],
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  archived_at: null,
  source: null,
  source_ref: null,
  origin: null,
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** What GET /api/ideas/1 answers next. */
let answer: () => Promise<Response>;
/** What GET /api/ideas/1/github-issues answers. */
let requests: FeatureRequest[];

beforeEach(() => {
  answer = async () => json(idea);
  requests = [];
  vi.stubGlobal('EventSource', QuietEventSource);
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/tags') return Promise.resolve(json([]));
      if (path === '/api/ideas/1/github-issues') return Promise.resolve(json(requests));
      if (path.startsWith('/api/github-issues/') && init?.method === 'POST') {
        requests = requests.map((r) => (r.state === 'failed' ? { ...r, state: 'pending', last_error: undefined } : r));
        return Promise.resolve(json(requests[0]));
      }
      return answer();
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderPage = () =>
  render(
    <LiveUpdatesProvider>
      <TagsProvider>
        <MemoryRouter initialEntries={['/nuggets/1']}>
          <Routes>
            <Route path="/nuggets/:id" element={<NuggetPage />} />
          </Routes>
        </MemoryRouter>
      </TagsProvider>
    </LiveUpdatesProvider>,
  );

describe('the project name', () => {
  it('shows under the title when the nugget has one', async () => {
    answer = async () => json({ ...idea, project_name: 'Ideanori' });
    renderPage();
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('A loaded nugget');
    // A pill: the name shows, and "Suggested project name" is its tooltip and accessible label.
    const pill = screen.getByLabelText('Suggested project name: Ideanori');
    expect(pill.textContent).toContain('Ideanori');
    expect(pill.getAttribute('title')).toBe('Suggested project name');
    expect(screen.queryByText(/Suggested project name/)).toBeNull();
  });

  it('is left out when the nugget has none', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByLabelText(/Suggested project name/)).toBeNull();
  });
});

/** Showing the tab fires every live listener, so the page reloads its nugget. */
const refresh = async () => {
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

describe('NuggetPage refresh', () => {
  it('keeps the loaded nugget when a refresh fails with anything but a 404', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'A loaded nugget' })).toBeTruthy();

    answer = () => Promise.reject(new TypeError('Failed to fetch'));
    await refresh();
    answer = async () => json({ error: { message: 'database is locked' } }, 500);
    await refresh();

    expect(screen.getByRole('heading', { name: 'A loaded nugget' })).toBeTruthy();
    expect(screen.queryByText('Not in the bank')).toBeNull();
  });

  it('shows not-found when a refresh finds the nugget gone', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'A loaded nugget' });

    answer = async () => json({ error: { message: 'idea not found' } }, 404);
    await refresh();

    expect(screen.getByText('Not in the bank')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'A loaded nugget' })).toBeNull();
  });

  it('shows not-found when the first load fails', async () => {
    answer = () => Promise.reject(new TypeError('Failed to fetch'));
    renderPage();
    expect(await screen.findByText('Not in the bank')).toBeTruthy();
  });
});

const request = (overrides: Partial<FeatureRequest>): FeatureRequest => ({
  id: 7,
  idea_id: 1,
  repo: 'Jarrod-Bob/nuggets',
  tag: 'nuggets',
  state: 'pending',
  attempts: 0,
  ...overrides,
});

describe('NuggetPage feature requests', () => {
  it('links to the created issue', async () => {
    requests = [request({ state: 'created', number: 42, url: 'https://github.com/Jarrod-Bob/nuggets/issues/42' })];
    renderPage();
    const link = (await screen.findByRole('link', { name: 'Feature request #42' })) as HTMLAnchorElement;
    expect(link.href).toBe('https://github.com/Jarrod-Bob/nuggets/issues/42');
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('shows a queued request with the error its retry is waiting on', async () => {
    requests = [request({ state: 'sending', attempts: 1, last_error: "Couldn't reach GitHub: timeout" })];
    renderPage();
    expect(await screen.findByText('Feature request queued')).toBeTruthy();
    expect(screen.getByText("Couldn't reach GitHub: timeout")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('shows a failed request with its error and retries it', async () => {
    requests = [request({ state: 'failed', attempts: 1, last_error: 'GitHub answered 404: Not Found.' })];
    renderPage();
    expect(await screen.findByText('Feature request failed')).toBeTruthy();
    expect(screen.getByText('GitHub answered 404: Not Found.')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    expect(await screen.findByText('Feature request queued')).toBeTruthy();
    expect(screen.queryByText('Feature request failed')).toBeNull();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/github-issues/7/retry', expect.objectContaining({ method: 'POST' }));
  });

  it('shows nothing for a nugget with no feature request', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'A loaded nugget' });
    expect(screen.queryByRole('list', { name: 'Feature requests' })).toBeNull();
  });
});

describe('NuggetPage plan with Claude', () => {
  const patches = () =>
    vi
      .mocked(fetch)
      .mock.calls.filter(([path, init]) => path === '/api/ideas/1' && init?.method === 'PATCH')
      .map(([, init]) => JSON.parse(String(init?.body)));

  it('links to Claude Desktop with the prompt and copies the full prompt', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    answer = async () => json({ ...idea, notes: 'Some notes.', tags: ['web'] });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Plan with Claude' }));

    const link = screen.getByRole('link', { name: 'Open in Claude Desktop' }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toMatch(/^claude:\/\/claude\.ai\/new\?q=/);
    const q = decodeURIComponent(link.getAttribute('href')!.split('?q=')[1]);
    expect(q).toContain('Title: A loaded nugget');
    expect(q).toContain('Some notes.');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }));
    });
    expect(writeText).toHaveBeenCalledWith(q);
    expect(screen.getByText('Copied the full prompt.')).toBeTruthy();
    expect(screen.queryByText(/carries a trimmed copy/)).toBeNull();
  });

  it('opens claude.ai only once the copy has settled', async () => {
    let finishCopy!: () => void;
    const writeText = vi.fn(() => new Promise<void>((resolve) => (finishCopy = resolve)));
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const open = vi.fn();
    vi.stubGlobal('open', open);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Plan with Claude' }));

    fireEvent.click(screen.getByRole('button', { name: 'Copy & open claude.ai' }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();

    await act(async () => finishCopy());
    expect(open).toHaveBeenCalledWith('https://claude.ai/new', '_blank', 'noopener');
    expect(screen.getByText('Copied the full prompt.')).toBeTruthy();
  });

  it('still opens claude.ai when the copy fails', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn(() => Promise.reject(new Error('Document is not focused'))) } });
    const open = vi.fn();
    vi.stubGlobal('open', open);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Plan with Claude' }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy & open claude.ai' }));
    });
    expect(open).toHaveBeenCalledWith('https://claude.ai/new', '_blank', 'noopener');
    expect(screen.getByText(/Couldn't copy/)).toBeTruthy();
  });

  it('says the copied prompt is complete when the link trims the notes', async () => {
    answer = async () => json({ ...idea, notes: 'long '.repeat(4_000) });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Plan with Claude' }));
    expect(screen.getByText(/carries a trimmed copy/)).toBeTruthy();
  });

  it('appends the pasted answer to the notes as they are on the server', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Plan with Claude' }));
    // Someone edited the notes since the page loaded; the save must keep that.
    answer = async () => json({ ...idea, notes: 'Edited elsewhere.' });

    const save = screen.getByRole('button', { name: 'Save to notes' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/^Claude's answer/), { target: { value: 'Build the MVP.' } });
    await act(async () => {
      fireEvent.click(save);
    });

    expect(patches()).toHaveLength(1);
    expect(patches()[0]).toEqual({ notes: expect.stringMatching(/^Edited elsewhere\.\n\nPlan with Claude \(\d{4}-\d{2}-\d{2}\):\nBuild the MVP\.$/) });
    expect(screen.queryByRole('dialog', { name: 'Plan with Claude' })).toBeNull();
  });

  it('keeps the answer and shows the error when the save fails', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Plan with Claude' }));
    answer = async () => json({ error: { message: 'database is locked' } }, 500);
    fireEvent.change(screen.getByLabelText(/^Claude's answer/), { target: { value: 'Build the MVP.' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save to notes' }));
    });

    expect(screen.getByRole('alert').textContent).toBe('database is locked');
    expect((screen.getByLabelText(/^Claude's answer/) as HTMLTextAreaElement).value).toBe('Build the MVP.');
    expect(patches()).toHaveLength(0);
  });
});
