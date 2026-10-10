import React from 'react';
import { api, describeError, type SpicesStatus, type SpicesSettingsUpdate } from '../api';
import { useLiveRefresh } from '../live/LiveUpdates';

/**
 * The spices settings, shared by every look (spices pull design §7, ADR 0002):
 * the address, API token and interval of the spices server nuggets pulls ideas
 * from, its status, and Connect / Disconnect / Sync now / Re-sync. The token is
 * write-only: it is never shown back, so the field is always empty and leaving
 * it empty keeps the stored one. Status is fetched each time `open` turns true.
 */
export interface SpicesSettingsModel {
  /** null until the first status arrives. */
  status: SpicesStatus | null;
  /** Whether the address/token/interval fields are open on a connected spices. */
  editing: boolean;
  startEditing: () => void;
  cancelEditing: () => void;
  url: string;
  setUrl: (url: string) => void;
  /** Write-only: empty keeps the stored token. */
  token: string;
  setToken: (token: string) => void;
  interval: string;
  setIntervalText: (seconds: string) => void;
  /** Connect, or save the changed fields. */
  save: () => void;
  disconnect: () => void;
  syncNow: () => void;
  /** Whether Re-sync is waiting for a second press. */
  confirmingResync: boolean;
  askResync: () => void;
  cancelResync: () => void;
  resync: () => void;
  notice: string | undefined;
  error: string | undefined;
  busy: boolean;
}

export function useSpicesSettings(open: boolean): SpicesSettingsModel {
  const [status, setStatus] = React.useState<SpicesStatus | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [url, setUrl] = React.useState('');
  const [token, setToken] = React.useState('');
  const [interval, setIntervalText] = React.useState('');
  const [confirmingResync, setConfirmingResync] = React.useState(false);
  const [notice, setNotice] = React.useState<string | undefined>(undefined);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback((clearError: boolean) => {
    if (clearError) setError(undefined);
    api.spices
      .status()
      .then(setStatus)
      .catch((err) => setError(describeError(err)));
  }, []);

  React.useEffect(() => {
    // Fetching status when the dialog opens is inherently a side effect (an
    // async request keyed off `open`), not state derivable during render.
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditing(false);
      setConfirmingResync(false);
      setNotice(undefined);
      refresh(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the last-sync line and any error current while the dialog is open:
  // pulls happen in the background, and the server says when the status moves.
  useLiveRefresh('spices-status', () => {
    if (open) refresh(false);
  });

  const startEditing = () => {
    if (!status) return;
    setUrl(status.url);
    setIntervalText(String(status.interval_seconds));
    setToken('');
    setEditing(true);
  };

  const save = () => {
    if (!status) return;
    const update: SpicesSettingsUpdate = { url: (url || status.url).trim() };
    if (token.trim()) update.token = token.trim();
    const seconds = Number((interval || String(status.interval_seconds)).trim());
    if (!Number.isInteger(seconds)) {
      setError('The sync interval needs to be a whole number of seconds.');
      return;
    }
    update.interval_seconds = seconds;

    setBusy(true);
    setError(undefined);
    api.spices
      .save(update)
      .then((s) => {
        setStatus(s);
        setToken('');
        setEditing(false);
      })
      .catch((err) => setError(describeError(err)))
      .finally(() => setBusy(false));
  };

  const disconnect = () => {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    api.spices
      .disconnect()
      .then(() => refresh(false))
      .catch((err) => setError(describeError(err)))
      .finally(() => setBusy(false));
  };

  const syncNow = () => {
    setBusy(true);
    api.spices
      .sync()
      .catch((err) => setError(describeError(err)))
      .finally(() => setBusy(false));
  };

  const resync = () => {
    setBusy(true);
    setError(undefined);
    api.spices
      .resync()
      .then((s) => {
        setStatus(s);
        setConfirmingResync(false);
        const n = s.detached ?? 0;
        setNotice(`${n} ${n === 1 ? 'nugget' : 'nuggets'} from the old spices kept, set aside as detached. Pulling everything in again.`);
      })
      .catch((err) => setError(describeError(err)))
      .finally(() => setBusy(false));
  };

  return {
    status, editing, startEditing, cancelEditing: () => setEditing(false),
    url, setUrl, token, setToken, interval, setIntervalText,
    save, disconnect, syncNow,
    confirmingResync, askResync: () => setConfirmingResync(true), cancelResync: () => setConfirmingResync(false), resync,
    notice, error, busy,
  };
}
