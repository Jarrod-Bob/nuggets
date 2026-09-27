import React from 'react';

/**
 * Live updates: nuggets arrive in the background (the spices pull),
 * and an open tab should show them without a reload. The server announces
 * changes on one server-sent event stream, `GET /api/events`
 * (internal/httpapi/events.go); an event carries no data — each view just
 * refetches what it shows through the regular API.
 *
 * One EventSource is opened here, at app level, and fanned out to every
 * `useLiveRefresh` in the tree. Because an event can be missed (a laptop asleep,
 * the stream dropped, the server restarted), every listener is also fired when
 * the tab becomes visible again and when the stream reconnects after a break.
 * A hidden tab holds no stream (each open one takes one of the browser's ~6
 * connections per host), so it's closed while hidden and reopened on showing.
 */

/** Mirrors internal/events.Event. */
export type LiveEvent = 'ideas-changed' | 'spices-status';
const LIVE_EVENTS: readonly LiveEvent[] = ['ideas-changed', 'spices-status'];

const EVENTS_URL = '/api/events';

// EventSource retries a dropped connection by itself, but gives up for good
// when the server answers with an error status. Then we open a new one.
const REOPEN_AFTER_MS = 5000;

type Listener = () => void;
type Subscribe = (event: LiveEvent, listener: Listener) => () => void;

const LiveContext = React.createContext<Subscribe | null>(null);

export function LiveUpdatesProvider({ children }: { children: React.ReactNode }) {
  const listeners = React.useRef(new Map<LiveEvent, Set<Listener>>());

  const subscribe = React.useCallback<Subscribe>((event, listener) => {
    const map = listeners.current;
    let set = map.get(event);
    if (!set) {
      set = new Set();
      map.set(event, set);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }, []);

  React.useEffect(() => {
    const fire = (event: LiveEvent) => {
      // Copy first: a listener may unsubscribe (or subscribe) while we loop.
      for (const listener of [...(listeners.current.get(event) ?? [])]) listener();
    };
    const fireAll = () => LIVE_EVENTS.forEach(fire);

    let source: EventSource | null = null;
    let reopenTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    // catchUp: fire every listener once this stream opens, because events may
    // have been missed before it did. Not needed for the page's first stream:
    // the page has just fetched everything.
    const open = (catchUp: boolean) => {
      const es = new EventSource(EVENTS_URL);
      source = es;
      let catchUpOnOpen = catchUp;
      es.onopen = () => {
        if (catchUpOnOpen) fireAll();
        catchUpOnOpen = false;
      };
      es.onerror = () => {
        // EventSource reconnects on its own; whatever it reconnects to has to
        // be caught up with.
        catchUpOnOpen = true;
        if (es.readyState === EventSource.CLOSED && !stopped) {
          reopenTimer = setTimeout(() => {
            if (!stopped) open(true);
          }, REOPEN_AFTER_MS);
        }
      };
      for (const event of LIVE_EVENTS) es.addEventListener(event, () => fire(event));
    };
    const close = () => {
      clearTimeout(reopenTimer);
      reopenTimer = undefined;
      source?.close();
      source = null;
    };

    if (document.visibilityState !== 'hidden') open(false);

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        close();
        return;
      }
      fireAll();
      if (!source) open(false);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopped = true;
      close();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <LiveContext.Provider value={subscribe}>{children}</LiveContext.Provider>;
}

export interface LiveRefreshOptions {
  /**
   * While true, events don't refetch: they're remembered, and one refetch runs
   * when hold turns false. Set it while a form holds unsaved edits that a
   * refetch would reset.
   */
  hold?: boolean;
}

/**
 * Calls `refetch` whenever `event` arrives (and on the provider's catch-up
 * triggers). Returns `pending`: true while a held refetch is waiting, so the
 * view can say that something new arrived.
 */
export function useLiveRefresh(event: LiveEvent, refetch: () => void, { hold = false }: LiveRefreshOptions = {}): { pending: boolean } {
  const subscribe = React.useContext(LiveContext);
  if (!subscribe) throw new Error('useLiveRefresh must be used within a LiveUpdatesProvider');

  // The latest refetch and hold, read when an event lands, so a new callback
  // identity each render never resubscribes.
  const refetchRef = React.useRef(refetch);
  const holdRef = React.useRef(hold);
  React.useLayoutEffect(() => {
    refetchRef.current = refetch;
    holdRef.current = hold;
  });

  const [pending, setPending] = React.useState(false);

  React.useEffect(
    () =>
      subscribe(event, () => {
        if (holdRef.current) setPending(true);
        else refetchRef.current();
      }),
    [subscribe, event],
  );

  React.useEffect(() => {
    if (hold || !pending) return;
    // Replaying a held event once the hold lifts is a side effect by nature.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPending(false);
    refetchRef.current();
  }, [hold, pending]);

  return { pending };
}
