import React from 'react';
import { Button } from '../core/Button';
import { Badge } from '../core/Badge';
import { Input } from '../forms/Input';
import { describeLastSync } from '../../lib/origin';
import { SettingsSection } from './SettingsSection';
import { useSpicesSettings } from '../../models/useSpicesSettings';

export interface SpicesSettingsProps {
  /** Whether the settings dialog is showing: status is fetched each time it opens. */
  open: boolean;
}

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
  const { status, busy, confirmingResync, disconnect, editing, error, interval, notice, resync, save, setConfirmingResync, setEditing, setIntervalText, setToken, setUrl, startEditing, syncNow, token, url } = useSpicesSettings(open);

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
