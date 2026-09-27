// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveUpdatesProvider, useLiveRefresh, type LiveEvent } from './LiveUpdates';
import { IdeaForm } from '../components/nuggets/IdeaForm';

/** Stands in for the browser's EventSource so a test can drive the stream. */
class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static instances: FakeEventSource[] = [];

  readyState = FakeEventSource.CONNECTING;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, Array<() => void>>();

  readonly url: string;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  addEventListener(name: string, fn: () => void) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), fn]);
  }
  close() {
    this.readyState = FakeEventSource.CLOSED;
  }

  open() {
    act(() => {
      this.readyState = FakeEventSource.OPEN;
      this.onopen?.();
    });
  }
  /** An error status: the browser gives up on this stream for good. */
  fail() {
    act(() => {
      this.readyState = FakeEventSource.CLOSED;
      this.onerror?.();
    });
  }
  /** A dropped connection the browser will retry by itself. */
  drop() {
    act(() => {
      this.readyState = FakeEventSource.CONNECTING;
      this.onerror?.();
    });
  }
  emit(name: LiveEvent) {
    act(() => {
      for (const fn of this.listeners.get(name) ?? []) fn();
    });
  }
}

const stream = (): FakeEventSource => {
  const live = FakeEventSource.instances.filter((s) => s.readyState !== FakeEventSource.CLOSED);
  expect(live).toHaveLength(1);
  return live[0];
};

const wrapper = ({ children }: { children: React.ReactNode }) => <LiveUpdatesProvider>{children}</LiveUpdatesProvider>;

const setVisibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Reflect.deleteProperty(document, 'visibilityState');
});

describe('useLiveRefresh', () => {
  it('opens one stream at /api/events and refetches on its event only', () => {
    const refetch = vi.fn();
    renderHook(() => useLiveRefresh('ideas-changed', refetch), { wrapper });
    const es = stream();
    expect(es.url).toBe('/api/events');
    es.open();
    expect(refetch).not.toHaveBeenCalled();

    es.emit('spices-status');
    expect(refetch).not.toHaveBeenCalled();
    es.emit('ideas-changed');
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shares the one stream between every listener', () => {
    const ideas = vi.fn();
    const status = vi.fn();
    renderHook(
      () => {
        useLiveRefresh('ideas-changed', ideas);
        useLiveRefresh('spices-status', status);
      },
      { wrapper },
    );
    const es = stream();
    es.emit('ideas-changed');
    es.emit('spices-status');
    expect(ideas).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledTimes(1);
  });

  it('uses the latest callback without resubscribing', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ fn }) => useLiveRefresh('ideas-changed', fn), {
      wrapper,
      initialProps: { fn: first },
    });
    rerender({ fn: second });
    stream().emit('ideas-changed');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('holds events while asked to and refetches once when the hold lifts', () => {
    const refetch = vi.fn();
    const { result, rerender } = renderHook(({ hold }) => useLiveRefresh('ideas-changed', refetch, { hold }), {
      wrapper,
      initialProps: { hold: true },
    });
    const es = stream();
    es.emit('ideas-changed');
    es.emit('ideas-changed');
    expect(refetch).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(true);

    rerender({ hold: false });
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(false);
  });

  it('catches up when the tab becomes visible again', () => {
    const refetch = vi.fn();
    renderHook(() => useLiveRefresh('ideas-changed', refetch), { wrapper });
    setVisibility('hidden');
    expect(refetch).not.toHaveBeenCalled();
    setVisibility('visible');
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('closes the stream while the tab is hidden and reopens one on showing', () => {
    const refetch = vi.fn();
    renderHook(() => useLiveRefresh('ideas-changed', refetch), { wrapper });
    const first = stream();
    first.open();

    setVisibility('hidden');
    expect(first.readyState).toBe(FakeEventSource.CLOSED);
    expect(FakeEventSource.instances.filter((s) => s.readyState !== FakeEventSource.CLOSED)).toHaveLength(0);

    setVisibility('visible');
    expect(refetch).toHaveBeenCalledTimes(1);
    const second = stream();
    expect(second).not.toBe(first);
    second.open();
    expect(refetch).toHaveBeenCalledTimes(1);
    second.emit('ideas-changed');
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it('opens no stream in a tab that starts hidden until it shows', () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    const refetch = vi.fn();
    renderHook(() => useLiveRefresh('ideas-changed', refetch), { wrapper });
    expect(FakeEventSource.instances).toHaveLength(0);

    setVisibility('visible');
    expect(FakeEventSource.instances).toHaveLength(1);
    stream().open();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('reopens a stream the browser gave up on, but not while the tab is hidden', () => {
    vi.useFakeTimers();
    const refetch = vi.fn();
    renderHook(() => useLiveRefresh('ideas-changed', refetch), { wrapper });
    stream().fail();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    stream().open();
    expect(refetch).toHaveBeenCalledTimes(1);

    stream().fail();
    setVisibility('hidden');
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(FakeEventSource.instances).toHaveLength(2);

    setVisibility('visible');
    expect(FakeEventSource.instances).toHaveLength(3);
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it('catches up when the stream reconnects after a break, not on its first open', () => {
    const refetch = vi.fn();
    renderHook(() => useLiveRefresh('ideas-changed', refetch), { wrapper });
    const es = stream();
    es.open();
    expect(refetch).not.toHaveBeenCalled();
    es.drop();
    es.open();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('closes the stream on unmount', () => {
    const { unmount } = renderHook(() => useLiveRefresh('ideas-changed', () => {}), { wrapper });
    const es = stream();
    unmount();
    expect(es.readyState).toBe(FakeEventSource.CLOSED);
  });
});

describe('an open edit form', () => {
  /**
   * NuggetPage in miniature: an edit form over a nugget that a live event
   * reloads, holding the reload while the form has unsaved edits.
   */
  function EditHarness({ fetchIdea }: { fetchIdea: () => { title: string } }) {
    const [idea, setIdea] = React.useState(fetchIdea);
    const [editing, setEditing] = React.useState(true);
    const [dirty, setDirty] = React.useState(false);
    const { pending } = useLiveRefresh('ideas-changed', () => setIdea(fetchIdea()), { hold: editing && dirty });
    return (
      <>
        <p data-testid="shown">{idea.title}</p>
        <IdeaForm
          open={editing}
          mode="edit"
          idea={idea}
          onDirtyChange={setDirty}
          notice={pending ? 'New nuggets arrived' : undefined}
          onClose={() => setEditing(false)}
        />
      </>
    );
  }

  it('keeps unsaved edits through an event and catches up after cancel', () => {
    let serverTitle = 'Original';
    const fetchIdea = vi.fn(() => ({ title: serverTitle }));
    render(<EditHarness fetchIdea={fetchIdea} />, { wrapper });
    const title = screen.getByLabelText('Title') as HTMLInputElement;
    expect(title.value).toBe('Original');

    fireEvent.change(title, { target: { value: 'My edit' } });
    serverTitle = 'Refreshed by spices';
    stream().emit('ideas-changed');

    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('My edit');
    expect(screen.getByRole('status').textContent).toBe('New nuggets arrived');
    expect(screen.getByTestId('shown').textContent).toBe('Original');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByTestId('shown').textContent).toBe('Refreshed by spices');
  });

  it('refreshes a form with no edits in place', () => {
    let serverTitle = 'Original';
    render(<EditHarness fetchIdea={() => ({ title: serverTitle })} />, { wrapper });
    serverTitle = 'Refreshed by spices';
    stream().emit('ideas-changed');
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Refreshed by spices');
  });
});
