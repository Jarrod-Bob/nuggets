import React from 'react';
import { Button } from '../core/Button';
import { Badge } from '../core/Badge';
import { IconButton } from '../core/IconButton';
import { Input } from '../forms/Input';
import { iconPlus, iconTrash } from '../icons';
import { api, ApiError, type GitHubMapping, type GitHubSettingsUpdate, type GitHubStatus } from '../../api';
import { SettingsSection } from './SettingsSection';
import { useLiveRefresh } from '../../live/LiveUpdates';
import { describeQueue } from '../../lib/featureRequest';

export interface GitHubSettingsProps {
  /** Whether the settings dialog is showing: status is fetched each time it opens. */
  open: boolean;
}

const describeError = (err: unknown): string => (err instanceof ApiError ? err.message : 'Something went wrong.');

const note: React.CSSProperties = { margin: '0 0 14px', fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-700)', textWrap: 'pretty' };
const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--nug-ink-500)' };

/**
 * The GitHub section of the settings dialog (tag-to-issue design §7): which
 * tags turn a nugget into a feature-request issue on which repository, the
 * fine-grained token that opens them, and the connection's status. The token
 * is write-only — it is never shown back, so the field is always empty and
 * leaving it empty keeps the stored one.
 */
export function GitHubSettings({ open }: GitHubSettingsProps) {
  const [status, setStatus] = React.useState<GitHubStatus | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [token, setToken] = React.useState('');
  const [rows, setRows] = React.useState<GitHubMapping[]>([]);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [busy, setBusy] = React.useState(false);

  /** Shows a fresh status and resets the mapping rows to it. */
  const load = React.useCallback((s: GitHubStatus) => {
    setStatus(s);
    setRows(s.mappings.map((m) => ({ ...m })));
  }, []);

  React.useEffect(() => {
    // Fetching status when the dialog opens is inherently a side effect (an
    // async request keyed off `open`), not state derivable during render.
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditing(false);
    setError(undefined);
    setToken('');
    api.github
      .status()
      .then(load)
      .catch((err) => setError(describeError(err)));
  }, [open, load]);

  // Keep the status line and queue counts current while the dialog is open.
  // Only the status: the mapping rows may hold unsaved edits.
  useLiveRefresh('github-changed', () => {
    if (!open) return;
    api.github
      .status()
      .then(setStatus)
      .catch(() => {});
  });

  const startEditing = () => {
    if (!status) return;
    setRows(status.mappings.map((m) => ({ ...m })));
    setToken('');
    setError(undefined);
    setEditing(true);
  };

  const cancelEditing = () => {
    if (status) setRows(status.mappings.map((m) => ({ ...m })));
    setToken('');
    setError(undefined);
    setEditing(false);
  };

  const setRow = (index: number, patch: Partial<GitHubMapping>) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const save = () => {
    // A row left completely blank is dropped rather than rejected.
    const update: GitHubSettingsUpdate = { mappings: rows.filter((r) => r.tag.trim() || r.repo.trim()) };
    if (token.trim()) update.token = token.trim();
    setBusy(true);
    setError(undefined);
    api.github
      .save(update)
      .then((s) => {
        load(s);
        setToken('');
        setEditing(false);
      })
      .catch((err) => setError(describeError(err)))
      .finally(() => setBusy(false));
  };

  const disconnect = () => {
    setBusy(true);
    setError(undefined);
    api.github
      .disconnect()
      .then(() => api.github.status())
      .then(load)
      .then(() => setEditing(false))
      .catch((err) => setError(describeError(err)))
      .finally(() => setBusy(false));
  };

  const form = status && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Input
        id="github-token"
        label="Personal access token"
        type="password"
        placeholder={status.connected ? 'Leave empty to keep the current token' : 'github_pat_…'}
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <Input
            id={`github-tag-${i}`}
            label="Tag"
            placeholder="nuggets"
            value={row.tag}
            onChange={(e) => setRow(i, { tag: e.target.value })}
            style={{ flex: '0 1 38%', minWidth: 0 }}
          />
          <Input
            id={`github-repo-${i}`}
            label="Repository"
            placeholder="owner/repo"
            value={row.repo}
            onChange={(e) => setRow(i, { repo: e.target.value })}
            style={{ flex: '1 1 auto', minWidth: 0 }}
          />
          <IconButton
            label={`Remove the ${row.tag.trim() || 'empty'} mapping`}
            onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
            style={{ marginBottom: 3, flexShrink: 0 }}
          >
            {iconTrash}
          </IconButton>
        </div>
      ))}
      <div>
        <Button variant="ghost" size="sm" iconLeft={iconPlus} onClick={() => setRows((prev) => [...prev, { tag: '', repo: '' }])}>
          Add a tag
        </Button>
      </div>
    </div>
  );

  const queue = status ? describeQueue(status.pending, status.failed) : null;

  return (
    <SettingsSection title="GitHub" description="Open a feature-request issue for each nugget that gets one of these tags.">
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
            {queue && <span style={{ ...mono, marginLeft: 'auto' }}>{queue}</span>}
          </div>

          {status.last_error && (
            <p style={{ margin: '0 0 14px', fontSize: 'var(--text-body-sm)', color: 'var(--nug-ketchup-600)' }}>{status.last_error}</p>
          )}

          {!status.connected && (
            <p style={note}>
              Create a fine-grained personal access token on GitHub with access to only the repositories below and one
              permission: Repository permissions → Issues: Read and write. Until one is saved, tagged nuggets wait in the
              queue. The token is stored in nuggets.db next to your ideas — copying or sharing that file shares it too.
            </p>
          )}

          {status.connected && !editing && (
            <ul style={{ margin: '0 0 16px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {status.mappings.length === 0 ? (
                <li style={note}>No tags are mapped, so nothing is sent.</li>
              ) : (
                status.mappings.map((m) => (
                  <li key={m.tag} style={{ fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-700)', overflowWrap: 'anywhere' }}>
                    <strong>#{m.tag}</strong> → <span style={{ fontFamily: 'var(--font-mono)' }}>{m.repo}</span>
                  </li>
                ))
              )}
            </ul>
          )}

          {(editing || !status.connected) && <div style={{ marginBottom: 16 }}>{form}</div>}

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
                  Change
                </Button>
              ) : (
                <>
                  {editing && (
                    <Button variant="ghost" onClick={cancelEditing} disabled={busy}>
                      Cancel
                    </Button>
                  )}
                  <Button onClick={save} disabled={busy}>
                    {!status.connected && token.trim() ? 'Connect' : 'Save'}
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
