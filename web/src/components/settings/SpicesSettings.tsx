import React from 'react';
import { Button } from '../core/Button';
import { Badge } from '../core/Badge';
import { Input } from '../forms/Input';
import { api, ApiError, type SpicesStatus, type SpicesSettingsUpdate } from '../../api';
import { describeLastSync } from '../../lib/origin';
import { SettingsSection } from './SettingsSection';
import { useLiveRefresh } from '../../live/LiveUpdates';

export interface SpicesSettingsProps {
  /** Whether the settings dialog is showing: status is fetched each time it opens. */
  open: boolean;
}

const describeError = (err: unknown): string => (err instanceof ApiError ? err.message : 'Something went wrong.');

const note: React.CSSProperties = { margin: '0 0 14px', fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-700)', textWrap: 'pretty' };
const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--nug-ink-500)' };

/**
 * The spices section of the settings dialog (spices pull design §7): the
 * address, API token and interval of the spices server nuggets pulls ideas
 * from, its status, and Connect / Disconnect / Sync now / Re-sync. The token
 * is write-only — it is never shown back, so the field is always empty and
 * leaving it empty keeps the stored one.
 */
export function SpicesSettings({ open }: SpicesSettingsProps) {
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

  const form = status && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Input label="spices address" type="url" placeholder={status.url} value={url} onChange={(e) => setUrl(e.target.value)} />
      <Input
        label="API token"
        type="password"
        placeholder={status.connected ? 'Leave empty to keep the current token' : 'SPICES_API_TOKEN from the spices server'}
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
      <Input
        label="Sync every (seconds)"
        type="number"
        placeholder={String(status.interval_seconds)}
        value={interval}
        onChange={(e) => setIntervalText(e.target.value)}
      />
    </div>
  );

  return (
    <SettingsSection title="spices" description="Pull ideas from your spices capture bot.">
      {error && (
        <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--nug-ketchup-100)', color: 'var(--nug-ketchup-600)', fontSize: 'var(--text-body-sm)' }}>
          {error}
        </div>
      )}

      {!status ? (
        <p style={{ color: 'var(--nug-ink-500)' }}>Loading…</p>
      ) : !status.connected ? (
        <div>
          <p style={note}>
            Point nuggets at your spices server and paste its API token. The token is stored in nuggets.db, next to your
            ideas — copying or sharing that file shares the token with it.
          </p>
          {form}
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button onClick={save} disabled={busy || !token.trim()}>
              Connect
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            {status.needs_resync ? <Badge tone="ketchup">Needs re-sync</Badge> : <Badge tone="herb">Connected</Badge>}
            <span style={{ ...mono, minWidth: 0, overflowWrap: 'anywhere' }}>{status.url}</span>
            <span style={{ ...mono, marginLeft: 'auto' }}>
              {describeLastSync(status.last_sync_at)} · every {status.interval_seconds}s
            </span>
          </div>

          {status.last_error && (
            <p style={{ margin: '0 0 14px', fontSize: 'var(--text-body-sm)', color: 'var(--nug-ketchup-600)' }}>{status.last_error}</p>
          )}
          {notice && <p style={note}>{notice}</p>}

          {status.needs_resync && !confirmingResync && (
            <p style={note}>
              The spices on the other end may hand out the same ids for different ideas, so nothing is pulled until
              you re-sync. Your nuggets are untouched.
            </p>
          )}
          {confirmingResync && (
            <p style={note}>
              Re-sync keeps every nugget that came from spices, sets them aside as detached, and pulls everything in spices
              in again as new nuggets. Ideas that were already here will show up twice.
            </p>
          )}

          {editing && <div style={{ marginBottom: 16 }}>{form}</div>}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <Button variant="danger" onClick={disconnect} disabled={busy}>
              Disconnect
            </Button>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {editing ? (
                <>
                  <Button variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
                    Cancel
                  </Button>
                  <Button onClick={save} disabled={busy}>
                    Save
                  </Button>
                </>
              ) : confirmingResync ? (
                <>
                  <Button variant="ghost" onClick={() => setConfirmingResync(false)} disabled={busy}>
                    Not yet
                  </Button>
                  <Button onClick={resync} disabled={busy}>
                    Re-sync
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={startEditing} disabled={busy}>
                    Change
                  </Button>
                  {status.needs_resync ? (
                    <Button onClick={() => setConfirmingResync(true)} disabled={busy}>
                      Re-sync
                    </Button>
                  ) : (
                    <Button variant="ghost" onClick={syncNow} disabled={busy}>
                      Sync now
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </SettingsSection>
  );
}
