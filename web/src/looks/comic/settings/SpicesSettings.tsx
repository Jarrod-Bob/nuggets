import { describeLastSync } from '../../../lib/origin';
import { useSpicesSettings } from '../../../models/useSpicesSettings';
import { ActionError, Button, Field } from '../ui';
import { SettingsSection } from './SettingsSection';

/**
 * The spices section of the Comic Settings dialog: the same model and the same
 * words as Classic's (spices pull design §7). The token is write-only, so its
 * field is always empty and leaving it empty keeps the stored one.
 */
export function SpicesSettings({ open }: { open: boolean }) {
  const { status, busy, confirmingResync, disconnect, editing, error, interval, notice, resync, save, askResync, cancelResync, cancelEditing, setIntervalText, setToken, setUrl, startEditing, syncNow, token, url } = useSpicesSettings(open);

  const form = status && (
    <div className="comic-settings-form">
      <Field label="spices address" type="url" placeholder={status.url} value={url} onChange={(e) => setUrl(e.target.value)} />
      <Field
        label="API token"
        type="password"
        placeholder={status.connected ? 'Leave empty to keep the current token' : 'SPICES_API_TOKEN from the spices server'}
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
      <Field label="Sync every (seconds)" type="number" placeholder={String(status.interval_seconds)} value={interval} onChange={(e) => setIntervalText(e.target.value)} />
    </div>
  );

  const section = { title: 'spices', description: 'Pull ideas from your spices capture bot.', error };

  if (!status) {
    return (
      <SettingsSection {...section}>
        <p className="comic-settings-note">Loading…</p>
      </SettingsSection>
    );
  }

  if (!status.connected) {
    return (
      <SettingsSection
        {...section}
        status={{ tone: 'off', label: 'Not connected' }}
        actions={
          <Button onClick={save} disabled={busy || !token.trim()}>
            Connect
          </Button>
        }
      >
        <p className="comic-settings-note">
          Point nuggets at your spices server and paste its API token. The token is stored in nuggets.db, next to your ideas — copying or sharing that file
          shares the token with it.
        </p>
        {form}
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      {...section}
      status={status.needs_resync ? { tone: 'attention', label: 'Needs re-sync' } : { tone: 'ok', label: 'Connected' }}
      detail={`${describeLastSync(status.last_sync_at)} · every ${status.interval_seconds}s`}
      dangerAction={
        <Button size="sm" variant="danger" onClick={disconnect} disabled={busy}>
          Disconnect
        </Button>
      }
      actions={
        editing ? (
          <>
            <Button size="sm" onClick={cancelEditing} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={busy}>
              Save
            </Button>
          </>
        ) : confirmingResync ? (
          <>
            <Button size="sm" onClick={cancelResync} disabled={busy}>
              Not yet
            </Button>
            <Button size="sm" onClick={resync} disabled={busy}>
              Re-sync
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" onClick={startEditing} disabled={busy}>
              Change
            </Button>
            {status.needs_resync ? (
              <Button size="sm" onClick={askResync} disabled={busy}>
                Re-sync
              </Button>
            ) : (
              <Button size="sm" onClick={syncNow} disabled={busy}>
                Sync now
              </Button>
            )}
          </>
        )
      }
    >
      <span className="comic-settings-url">{status.url}</span>
      <ActionError message={status.last_error} />
      {notice && <p className="comic-settings-note">{notice}</p>}
      {status.needs_resync && !confirmingResync && (
        <p className="comic-settings-note">
          The spices on the other end may hand out the same ids for different ideas, so nothing is pulled until you re-sync. Your nuggets are untouched.
        </p>
      )}
      {confirmingResync && (
        <p className="comic-settings-note">
          Re-sync keeps every nugget that came from spices, sets them aside as detached, and pulls everything in spices in again as new nuggets. Ideas that
          were already here will show up twice.
        </p>
      )}
      {editing && form}
    </SettingsSection>
  );
}
