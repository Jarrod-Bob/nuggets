import React from 'react';
import { api, ApiError, type TagSuggestionStatus } from '../api';
import { useLiveRefresh } from '../live/LiveUpdates';

const describeError = (err: unknown): string => (err instanceof ApiError ? err.message : 'Something went wrong.');

/**
 * The tag-suggestion settings, shared by every look (Jev tag-suggestions design
 * §7, ADR 0002): the TypeSafe API key that turns suggestions on and the
 * connection's status. The key is write-only: it is never shown back, so the
 * field is always empty. Status is fetched each time `open` turns true.
 */
export function useJevSettings(open: boolean) {
  const [status, setStatus] = React.useState<TagSuggestionStatus | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [key, setKey] = React.useState('');
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    // Fetching status when the dialog opens is inherently a side effect (an
    // async request keyed off `open`), not state derivable during render.
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditing(false);
    setError(undefined);
    setKey('');
    api.tagSuggestions
      .status()
      .then(setStatus)
      .catch((err) => setError(describeError(err)));
  }, [open]);

  // Keep the status line and the waiting count current while the dialog is open.
  useLiveRefresh('tag-suggestions-changed', () => {
    if (!open) return;
    api.tagSuggestions
      .status()
      .then(setStatus)
      .catch(() => {});
  });

  const save = () => {
    setBusy(true);
    setError(undefined);
    api.tagSuggestions
      .connect(key.trim())
      .then((s) => {
        setStatus(s);
        setKey('');
        setEditing(false);
      })
      .catch((err) => setError(describeError(err)))
      .finally(() => setBusy(false));
  };

  const disconnect = () => {
    setBusy(true);
    setError(undefined);
    api.tagSuggestions
      .disconnect()
      .then(() => api.tagSuggestions.status())
      .then(setStatus)
      .then(() => setEditing(false))
      .catch((err) => setError(describeError(err)))
      .finally(() => setBusy(false));
  };

  return { status, busy, disconnect, editing, error, key, save, setEditing, setError, setKey };
}

export type JevSettingsModel = ReturnType<typeof useJevSettings>;
