import React from 'react';
import { api, ApiError, KIMI_MODEL_ERROR_CODE, type KimiName } from '../api';

/**
 * kimi-no-name-wa's name suggestions for the form's project name, shared by
 * every look (kimi project-name design §5, ADR 0002). kimi's health is checked
 * when the hook mounts, so mount it with the form; unmounting aborts a call in
 * flight and forgets the names already shown.
 */
export interface KimiNames {
  /** null while the health check is in flight. */
  available: boolean | null;
  /**
   * Why names can't be asked for right now, if they can't. 'model-error' is
   * kimi up but its model failing: the look shows that in place of the
   * unavailable hint, and it lasts for the rest of the form.
   */
  blocked: 'no-notes' | 'unavailable' | 'model-error' | null;
  /** Whether a request is in flight. */
  naming: boolean;
  /**
   * 'failed' is anything but a cancel or a model error: the look says kimi
   * isn't available. 'modelError' says kimi's model couldn't run.
   */
  results:
    | { state: 'none' }
    | { state: 'failed' }
    | { state: 'modelError' }
    | { state: 'names'; names: KimiName[] };
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
  // The request in flight, if any: what Cancel aborts.
  const [request, setRequest] = React.useState<AbortController | null>(null);
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
      const pending = inFlight.current;
      inFlight.current = null;
      pending?.abort();
    };
  }, []);

  const ask = (avoid: string[]) => {
    const controller = new AbortController();
    inFlight.current = controller;
    setRequest(controller);
    api.kimi
      .names(notes.trim(), avoid, controller.signal)
      .then((names) => {
        shown.current = [...shown.current, ...names.map((n) => n.name)];
        setResults({ state: 'names', names });
      })
      .catch((err: unknown) => {
        // A cancel leaves the list as it was. kimi's model failing to run
        // would fail every try the same way, slowly, so kimi is off for the
        // rest of this form. Anything else is "not available".
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && err.code === KIMI_MODEL_ERROR_CODE) {
          setAvailable(false);
          setResults({ state: 'modelError' });
        } else {
          setResults({ state: 'failed' });
        }
      })
      .finally(() => {
        if (inFlight.current === controller) {
          inFlight.current = null;
          setRequest(null);
        }
      });
  };

  const notesEmpty = notes.trim() === '';
  return {
    available,
    blocked: notesEmpty
      ? 'no-notes'
      : results.state === 'modelError' ? 'model-error' : available === false ? 'unavailable' : null,
    naming: request !== null,
    results,
    generate: () => ask([]),
    reroll: () => ask(shown.current),
    cancel: () => request?.abort(),
    point: setPointed,
    explanation: results.state === 'names' ? results.names.find((n) => n.name === (pointed ?? value))?.explanation : undefined,
  };
}
