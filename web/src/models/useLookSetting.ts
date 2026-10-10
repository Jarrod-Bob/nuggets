import React from 'react';
import { api, describeError } from '../api';
import { applyLook, isLook, readLook, type Look } from '../looks/look';

/**
 * The Look picker's state, shared by every look (ADR 0002): the saved Look,
 * fetched each time `open` turns true. Choosing one saves it first; only then
 * does the open page switch (<html data-look>), so a failed save leaves both
 * the selection and the page where they were.
 */
export interface LookSettingModel {
  /** The saved Look, or undefined until it has loaded. */
  look: Look | undefined;
  choose: (look: Look) => void;
  error: string | undefined;
  busy: boolean;
}

export function useLookSetting(open: boolean): LookSettingModel {
  const [look, setLook] = React.useState<Look | undefined>(undefined);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let live = true;
    api.look
      .get()
      .then((s) => {
        if (!live) return;
        setLook(isLook(s.look) ? s.look : 'classic');
        setError(undefined);
      })
      .catch((err) => {
        // Keep the picker usable: assume the Look the page is showing.
        if (!live) return;
        setLook(readLook() ?? 'classic');
        setError(describeError(err));
      });
    return () => {
      live = false;
    };
  }, [open]);

  const choose = (next: Look) => {
    setBusy(true);
    setError(undefined);
    api.look
      .save({ look: next })
      .then((s) => {
        const saved = isLook(s.look) ? s.look : next;
        setLook(saved);
        applyLook(saved);
      })
      .catch((err) => setError(describeError(err)))
      .finally(() => setBusy(false));
  };

  return { look, choose, error, busy };
}
