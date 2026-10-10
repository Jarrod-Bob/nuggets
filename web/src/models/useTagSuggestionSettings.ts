import React from 'react';
import { api, describeError, type TagSuggestionStatus } from '../api';
import { useLiveRefresh } from '../live/LiveUpdates';

/**
 * The tag-suggestion settings, shared by every look (Jev tag-suggestions design
 * §7, ADR 0002): the TypeSafe API key that turns suggestions on and the
 * connection's status. The key is write-only: it is never shown back, so the
 * field is always empty. Status is fetched each time `open` turns true.
 */
export interface TagSuggestionSettingsModel {
  /** null until the first status arrives. */
  status: TagSuggestionStatus | null;
  /** Whether the key field is open on a connected TypeSafe. */
  editing: boolean;
  startEditing: () => void;
  /** Closes the key field and forgets what was typed. */
  cancelEditing: () => void;
  /** Write-only: never shown back. */
  key: string;
  setKey: (key: string) => void;
  save: () => void;
  disconnect: () => void;
  error: string | undefined;
  busy: boolean;
}

export function useTagSuggestionSettings(open: boolean): TagSuggestionSettingsModel {
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

  return {
    status, editing,
    startEditing: () => setEditing(true),
    cancelEditing: () => {
      setKey('');
      setError(undefined);
      setEditing(false);
    },
    key, setKey, save, disconnect, error, busy,
  };
}
