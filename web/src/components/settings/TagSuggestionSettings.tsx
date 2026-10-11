import React from 'react';
import { Button } from '../core/Button';
import { Badge } from '../core/Badge';
import { Input } from '../forms/Input';
import { SettingsSection } from './SettingsSection';
import { useTagSuggestionSettings } from '../../models/useTagSuggestionSettings';

export interface TagSuggestionSettingsProps {
  /** Whether the settings dialog is showing: status is fetched each time it opens. */
  open: boolean;
}

/** Where TypeSafe issues API keys. */
const KEYS_URL = 'https://console.typesafe.ai/keys';

const note: React.CSSProperties = { margin: '0 0 14px', fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-700)', textWrap: 'pretty' };
const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--nug-ink-500)' };

/** "N nuggets waiting to be checked", or null when none are. */
function describePending(pending: number): string | null {
  if (pending <= 0) return null;
  return `${pending} ${pending === 1 ? 'nugget' : 'nuggets'} waiting to be checked`;
}

/**
 * The "Tag suggestions" section of the settings dialog (Jev tag-suggestions
 * design §7): the TypeSafe API key that turns suggestions on, the connection's
 * status, and how many nuggets wait to be checked. The key is write-only — it
 * is never shown back, so the field is always empty.
 */
export function TagSuggestionSettings({ open }: TagSuggestionSettingsProps) {
  const { status, busy, disconnect, editing, error, key, save, startEditing, cancelEditing, setKey } = useTagSuggestionSettings(open);

  const waiting = status ? describePending(status.pending) : null;
  const showForm = status && (editing || !status.connected);

  return (
    <SettingsSection title="Tag suggestions" description="Suggest tags you already use that a nugget seems to be missing. Nothing is tagged until you add it.">
      {error && (
        <div
          role="alert"
          style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--nug-ketchup-100)', color: 'var(--nug-ketchup-600)', fontSize: 'var(--text-body-sm)' }}
        >
          {error}
        </div>
      )}

      {!status ? (
        <p style={{ color: 'var(--nug-ink-500)' }}>Loading…</p>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            {status.connected ? <Badge tone="herb">Connected</Badge> : <Badge>Not connected</Badge>}
            {waiting && <span style={{ ...mono, marginLeft: 'auto' }}>{waiting}</span>}
          </div>

          {status.last_error && (
            <p style={{ margin: '0 0 14px', fontSize: 'var(--text-body-sm)', color: 'var(--nug-ketchup-600)', overflowWrap: 'anywhere' }}>{status.last_error}</p>
          )}

          {!status.connected && (
            <p style={note}>
              Suggestions come from{' '}
              <a href={KEYS_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--nug-ink-900)', fontWeight: 'var(--weight-bold)' }}>
                TypeSafe — get an API key
              </a>
              . Each nugget whose title or notes change is checked once against the tags in use; nuggets saved before a key
              is added aren't checked until they next change. The key is stored in nuggets.db next to your ideas — copying
              or sharing that file shares it too.
            </p>
          )}

          {showForm && (
            <div style={{ marginBottom: 16 }}>
              <Input
                id="tag-suggestions-key"
                label="TypeSafe API key"
                type="password"
                placeholder="Paste the key from TypeSafe"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            {status.connected ? (
              <Button variant="danger" onClick={disconnect} disabled={busy}>
                Disconnect
              </Button>
            ) : (
              <span />
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {status.connected && !editing ? (
                <Button variant="ghost" onClick={startEditing} disabled={busy}>
                  Change key
                </Button>
              ) : (
                <>
                  {editing && (
                    <Button
                      variant="ghost"
                      onClick={cancelEditing}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button onClick={save} disabled={busy || !key.trim()}>
                    {status.connected ? 'Save' : 'Connect'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </SettingsSection>
  );
}
