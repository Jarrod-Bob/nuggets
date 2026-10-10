import React from 'react';
import { api, ApiError, type SpicesStatus, type SpicesSettingsUpdate } from '../api';
import { useLiveRefresh } from '../live/LiveUpdates';

const describeError = (err: unknown): string => (err instanceof ApiError ? err.message : 'Something went wrong.');

/**
 * The spices settings, shared by every look (spices pull design §7, ADR 0002):
 * the address, API token and interval of the spices server nuggets pulls ideas
 * from, its status, and Connect / Disconnect / Sync now / Re-sync. The token is
 * write-only: it is never shown back, so the field is always empty and leaving
 * it empty keeps the stored one. Status is fetched each time `open` turns true.
 */
export function useSpicesSettings(open: boolean) {
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

  return { status, busy, confirmingResync, disconnect, editing, error, interval, notice, resync, save, setConfirmingResync, setEditing, setIntervalText, setToken, setUrl, startEditing, syncNow, token, url };
}

export type SpicesSettingsModel = ReturnType<typeof useSpicesSettings>;
