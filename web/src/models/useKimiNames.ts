import React from 'react';
import { api, type KimiName } from '../api';

/**
 * kimi-no-name-wa's name suggestions for the form's project name, shared by
 * every look (kimi project-name design §5, ADR 0002). kimi's health is checked
 * when the hook mounts, so mount it with the form; unmounting aborts a call in
 * flight and forgets the names already shown.
 */
export interface KimiNames {
  /** null while the health check is in flight. */
  available: boolean | null;
  /** Why names can't be asked for right now, if they can't. */
  blocked: 'no-notes' | 'unavailable' | null;
  /** Whether a request is in flight. */
  naming: boolean;
  /** 'failed' is anything but a cancel: the look says kimi isn't available. */
  results: { state: 'none' } | { state: 'failed' } | { state: 'names'; names: KimiName[] };
  /** Ask for five names. */
  generate: () => void;
  /** Ask for five more, avoiding every name shown since the form opened. */
  reroll: () => void;
  /** Abort the request in flight; the list stays as it was. */
  cancel: () => void;
  /** Point at a name (pointer or keyboard focus), or at none. */
  point: (name: string | null) => void;
  /** The explanation to show: the pointed name's, else the picked one's. */
  explanation: string | undefined;
}

export function useKimiNames({ notes, value }: { notes: string; value: string }): KimiNames {
  const [available, setAvailable] = React.useState<boolean | null>(null);
  const [naming, setNaming] = React.useState<AbortController | null>(null);
  const [results, setResults] = React.useState<KimiNames['results']>({ state: 'none' });
  // Every name shown this form session, for Re-roll's avoid. A ref, not
  // state: nothing renders from it.
  const shown = React.useRef<string[]>([]);
  const inFlight = React.useRef<AbortController | null>(null);
  const [pointed, setPointed] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    api.kimi.available().then((ok) => {
      if (live) setAvailable(ok);
    });
    return () => {
      live = false;
      // Forget the request before aborting it, so its finally doesn't set
      // state on a field that is gone.
      const request = inFlight.current;
      inFlight.current = null;
      request?.abort();
    };
  }, []);

  const ask = (avoid: string[]) => {
    const controller = new AbortController();
    inFlight.current = controller;
    setNaming(controller);
    api.kimi
      .names(notes.trim(), avoid, controller.signal)
      .then((names) => {
        shown.current = [...shown.current, ...names.map((n) => n.name)];
        setResults({ state: 'names', names });
      })
      .catch(() => {
        // A cancel leaves the list as it was; anything else is "not available".
        if (!controller.signal.aborted) setResults({ state: 'failed' });
      })
      .finally(() => {
        if (inFlight.current === controller) {
          inFlight.current = null;
          setNaming(null);
        }
      });
  };

  const notesEmpty = notes.trim() === '';
  return {
    available,
    blocked: notesEmpty ? 'no-notes' : available === false ? 'unavailable' : null,
    naming: naming !== null,
    results,
    generate: () => ask([]),
    reroll: () => ask(shown.current),
    cancel: () => naming?.abort(),
    point: setPointed,
    explanation: results.state === 'names' ? results.names.find((n) => n.name === (pointed ?? value))?.explanation : undefined,
  };
}
