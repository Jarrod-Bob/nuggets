import React from 'react';
import { api, describeError, type GitHubMapping, type GitHubSettingsUpdate, type GitHubStatus } from '../api';
import { useLiveRefresh } from '../live/LiveUpdates';

/**
 * The GitHub settings, shared by every look (tag-to-issue design §7, ADR 0002):
 * which tags turn a nugget into a feature-request issue on which repository,
 * the fine-grained token that opens them, and the connection's status. The
 * token is write-only: it is never shown back, so the field is always empty
 * and leaving it empty keeps the stored one. Status is fetched each time
 * `open` turns true.
 */
export interface GitHubSettingsModel {
  /** null until the first status arrives. */
  status: GitHubStatus | null;
  /** Whether the token and mapping fields are open on a connected GitHub. */
  editing: boolean;
  startEditing: () => void;
  /** Puts the rows back as they were saved. */
  cancelEditing: () => void;
  /** Write-only: empty keeps the stored token. */
  token: string;
  setToken: (token: string) => void;
  /** The tag → repository mappings being edited. */
  rows: GitHubMapping[];
  setRow: (index: number, patch: Partial<GitHubMapping>) => void;
  addRow: () => void;
  removeRow: (index: number) => void;
  /** Connect, or save the changed fields; a completely blank row is dropped. */
  save: () => void;
  disconnect: () => void;
  error: string | undefined;
  busy: boolean;
}

export function useGitHubSettings(open: boolean): GitHubSettingsModel {
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

  return {
    status, editing, startEditing, cancelEditing,
    token, setToken,
    rows, setRow,
    addRow: () => setRows((prev) => [...prev, { tag: '', repo: '' }]),
    removeRow: (index) => setRows((prev) => prev.filter((_, j) => j !== index)),
    save, disconnect, error, busy,
  };
}
