import { describeQueue } from '../../../lib/featureRequest';
import { useGitHubSettings } from '../../../models/useGitHubSettings';
import { ActionError, Button, Field, Icon, IconButton } from '../ui';
import { SettingsSection } from './SettingsSection';

/**
 * The GitHub section of the Comic Settings dialog: which tags turn a nugget
 * into a feature-request issue on which repository, the fine-grained token
 * that opens them, and the connection's status (tag-to-issue design §7). The
 * token is write-only, so its field is always empty.
 */
export function GitHubSettings({ open }: { open: boolean }) {
  const { status, busy, cancelEditing, disconnect, editing, error, rows, save, setRow, addRow, removeRow, setToken, startEditing, token } = useGitHubSettings(open);

  const section = { title: 'GitHub', description: 'Open a feature-request issue for each nugget that gets one of these tags.', error };

  if (!status) {
    return (
      <SettingsSection {...section}>
        <p className="comic-settings-note">Loading…</p>
      </SettingsSection>
    );
  }

  const form = (
    <div className="comic-settings-form">
      <Field
        id="github-token"
        label="Personal access token"
        type="password"
        placeholder={status.connected ? 'Leave empty to keep the current token' : 'github_pat_…'}
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
      {rows.map((row, i) => (
        <div key={i} className="comic-settings-row">
          <Field id={`github-tag-${i}`} label="Tag" placeholder="nuggets" value={row.tag} onChange={(e) => setRow(i, { tag: e.target.value })} style={{ flex: '0 1 38%' }} />
          <Field id={`github-repo-${i}`} label="Repository" placeholder="owner/repo" value={row.repo} onChange={(e) => setRow(i, { repo: e.target.value })} style={{ flex: '1 1 auto' }} />
          <IconButton label={`Remove the ${row.tag.trim() || 'empty'} mapping`} onClick={() => removeRow(i)}>
            <Icon name="trash" size={16} />
          </IconButton>
        </div>
      ))}
      <div>
        <Button size="sm" icon="plus" onClick={addRow}>
          Add a tag
        </Button>
      </div>
    </div>
  );

  return (
    <SettingsSection
      {...section}
      status={status.connected ? { tone: 'ok', label: 'Connected' } : { tone: 'off', label: 'Not connected' }}
      detail={describeQueue(status.pending, status.failed)}
      dangerAction={
        status.connected && (
          <Button size="sm" variant="danger" onClick={disconnect} disabled={busy}>
            Disconnect
          </Button>
        )
      }
      actions={
        status.connected && !editing ? (
          <Button size="sm" onClick={startEditing} disabled={busy}>
            Change
          </Button>
        ) : (
          <>
            {editing && (
              <Button size="sm" onClick={cancelEditing} disabled={busy}>
                Cancel
              </Button>
            )}
            <Button size="sm" onClick={save} disabled={busy}>
              {!status.connected && token.trim() ? 'Connect' : 'Save'}
            </Button>
          </>
        )
      }
    >
      <ActionError message={status.last_error} />
      {!status.connected && (
        <p className="comic-settings-note">
          Create a fine-grained personal access token on GitHub with access to only the repositories below and one permission: Repository permissions → Issues:
          Read and write. Until one is saved, tagged nuggets wait in the queue. The token is stored in nuggets.db next to your ideas — copying or sharing that
          file shares it too.
        </p>
      )}
      {status.connected && !editing && (
        <ul className="comic-settings-mappings">
          {status.mappings.length === 0 ? (
            <li className="comic-settings-note">No tags are mapped, so nothing is sent.</li>
          ) : (
            status.mappings.map((m) => (
              <li key={m.tag}>
                <strong>#{m.tag}</strong> → <span className="comic-settings-url">{m.repo}</span>
              </li>
            ))
          )}
        </ul>
      )}
      {(editing || !status.connected) && form}
    </SettingsSection>
  );
}
