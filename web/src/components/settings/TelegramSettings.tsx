import React from 'react';
import { Button } from '../core/Button';
import { Badge } from '../core/Badge';
import { Input } from '../forms/Input';
import { api, ApiError, type TelegramStatus } from '../../api';
import { describeLastSync } from '../../lib/origin';
import { SettingsSection } from './SettingsSection';

export interface TelegramSettingsProps {
  /** Whether the settings dialog is showing: status is fetched each time it opens. */
  open: boolean;
}

/**
 * The Telegram section of the settings dialog (design §11): connect a bot
 * token, pair it to one chat, see status, disconnect.
 */
export function TelegramSettings({ open }: TelegramSettingsProps) {
  const [status, setStatus] = React.useState<TelegramStatus | null>(null);
  const [token, setToken] = React.useState('');
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [busy, setBusy] = React.useState(false);

  const describeError = (err: unknown): string => (err instanceof ApiError ? err.message : 'Something went wrong.');

  const refresh = React.useCallback((clearError: boolean) => {
    if (clearError) setError(undefined);
    api.telegram
      .status()
      .then(setStatus)
      .catch((err) => setError(describeError(err)));
  }, []);

  React.useEffect(() => {
    // Fetching status when the dialog opens is inherently a side effect (an
    // async request keyed off `open`), not state derivable during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) refresh(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // While connected, poll status so the dialog notices the moment the phone
  // sends a pairing code, and keeps the last-sync line current — the
  // alternative is asking the user to close and reopen the dialog.
  const connected = !!status?.connected;
  React.useEffect(() => {
    if (!open || !connected) return;
    const id = window.setInterval(() => refresh(false), 3000);
    return () => window.clearInterval(id);
  }, [open, connected, refresh]);

  const connect = () => {
    if (!token.trim()) return;
    setBusy(true);
    setError(undefined);
    api.telegram
      .connect(token.trim())
      .then((s) => {
        setStatus(s);
        setToken('');
      })
      .catch((err) => setError(describeError(err)))
      .finally(() => setBusy(false));
  };

  const disconnect = () => {
    setBusy(true);
    setError(undefined);
    api.telegram
      .disconnect()
      .then(() => refresh(false))
      .catch((err) => setError(describeError(err)))
      .finally(() => setBusy(false));
  };

  const requestPairCode = () => {
    setBusy(true);
    setError(undefined);
    api.telegram
      .pair()
      .then(setStatus)
      .catch((err) => setError(describeError(err)))
      .finally(() => setBusy(false));
  };

  const syncNow = () => {
    setBusy(true);
    api.telegram
      .sync()
      .catch((err) => setError(describeError(err)))
      .finally(() => setBusy(false));
  };

  return (
    <SettingsSection title="Telegram" description="Capture nuggets by texting a bot from your phone.">
      {error && (
        <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 'var(--radius-md, 8px)', background: 'var(--nug-red-50, #fef2f2)', color: 'var(--nug-red-700, #b91c1c)', fontSize: 'var(--text-small, 13px)' }}>
          {error}
        </div>
      )}

      {!status ? (
        <p style={{ color: 'var(--nug-ink-500)' }}>Loading…</p>
      ) : !status.connected ? (
        <div>
          <p style={{ margin: '0 0 14px', fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-700)' }}>
            Create a bot with{' '}
            <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">
              @BotFather
            </a>
            , then paste the token it gives you. The token is stored in nuggets.db, next to your ideas — copying or
            sharing that file shares the bot credential with it.
          </p>
          <Input label="Bot token" placeholder="123456:AA...token" value={token} onChange={(e) => setToken(e.target.value)} />
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={connect} disabled={busy || !token.trim()}>
              Connect
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Badge tone="herb">Connected</Badge>
            {status.username && <span style={{ fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-700)' }}>@{status.username}</span>}
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--nug-ink-500)' }}>
              {describeLastSync(status.last_sync_at)}
            </span>
          </div>

          {status.paired ? (
            <div style={{ marginBottom: 14 }}>
              <Badge tone="herb">Paired</Badge>
              <p style={{ margin: '10px 0 0', fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-700)' }}>
                Messages you send the bot are saved as nuggets. The first line becomes the title, the rest becomes
                notes, and any #hashtags become tags.
              </p>
            </div>
          ) : status.pair_code ? (
            <div style={{ marginBottom: 14 }}>
              <Badge tone="golden">Awaiting pairing</Badge>
              <p style={{ margin: '10px 0 6px', fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-700)' }}>
                Send this code to the bot from the chat you want paired:
              </p>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-title-2)', fontWeight: 700, letterSpacing: '0.15em', textAlign: 'center', padding: '10px 0', background: 'var(--nug-cream-100)', borderRadius: 'var(--radius-md)' }}>
                {status.pair_code}
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 'var(--text-micro)', color: 'var(--nug-ink-500)' }}>
                Valid for 15 minutes. The first chat to send it becomes the only chat the bot listens to.
              </p>
            </div>
          ) : (
            <div style={{ marginBottom: 14 }}>
              <Badge tone="neutral">Unpaired</Badge>
              <p style={{ margin: '10px 0 0', fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-700)' }}>
                Generate a pairing code and send it to the bot to start capturing.
              </p>
            </div>
          )}

          {status.last_error && (
            <p style={{ margin: '0 0 14px', fontSize: 'var(--text-body-sm)', color: 'var(--nug-ketchup-600)' }}>{status.last_error}</p>
          )}

          <p style={{ margin: '0 0 16px', fontSize: 'var(--text-micro)', color: 'var(--nug-ink-500)' }}>
            Telegram only holds undelivered messages for about 24 hours — a machine left off longer than that loses
            anything older.
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <Button variant="danger" onClick={disconnect} disabled={busy}>
              Disconnect
            </Button>
            <div style={{ display: 'flex', gap: 10 }}>
              {status.paired && (
                <Button variant="ghost" onClick={syncNow} disabled={busy}>
                  Sync now
                </Button>
              )}
              {!status.paired && (
                <Button onClick={requestPairCode} disabled={busy}>
                  {status.pair_code ? 'New code' : 'Generate code'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </SettingsSection>
  );
}
