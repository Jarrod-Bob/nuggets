import { useTagSuggestionSettings } from '../../../models/useTagSuggestionSettings';
import { ActionError, Button, Field } from '../ui';
import { SettingsSection } from './SettingsSection';

/** Where TypeSafe issues API keys. */
const KEYS_URL = 'https://console.typesafe.ai/keys';

/** "N nuggets waiting to be checked", or null when none are. */
function describePending(pending: number): string | null {
  if (pending <= 0) return null;
  return `${pending} ${pending === 1 ? 'nugget' : 'nuggets'} waiting to be checked`;
}

/**
 * The "Tag suggestions" section of the Comic Settings dialog: the TypeSafe API
 * key that turns suggestions on, the connection's status, and how many
 * nuggets wait to be checked (Jev tag-suggestions design §7). The key is
 * write-only, so its field is always empty.
 */
export function TagSuggestionSettings({ open }: { open: boolean }) {
  const { status, busy, disconnect, editing, error, key, save, startEditing, cancelEditing, setKey } = useTagSuggestionSettings(open);

  const section = {
    title: 'Tag suggestions',
    description: 'Suggest tags you already use that a nugget seems to be missing. Nothing is tagged until you add it.',
    error,
  };

  if (!status) {
    return (
      <SettingsSection {...section}>
        <p className="comic-settings-note">Loading…</p>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      {...section}
      status={status.connected ? { tone: 'ok', label: 'Connected' } : { tone: 'off', label: 'Not connected' }}
      detail={describePending(status.pending)}
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
            Change key
          </Button>
        ) : (
          <>
            {editing && (
              <Button size="sm" onClick={cancelEditing} disabled={busy}>
                Cancel
              </Button>
            )}
            <Button size="sm" onClick={save} disabled={busy || !key.trim()}>
              {status.connected ? 'Save' : 'Connect'}
            </Button>
          </>
        )
      }
    >
      <ActionError message={status.last_error} />
      {!status.connected && (
        <p className="comic-settings-note">
          Suggestions come from{' '}
          <a href={KEYS_URL} target="_blank" rel="noreferrer">
            TypeSafe — get an API key
          </a>
          . Each nugget whose title or notes change is checked once against the tags in use; nuggets saved before a key is added aren't checked until they next
          change. The key is stored in nuggets.db next to your ideas — copying or sharing that file shares it too.
        </p>
      )}
      {(editing || !status.connected) && (
        <Field id="tag-suggestions-key" label="TypeSafe API key" type="password" placeholder="Paste the key from TypeSafe" value={key} onChange={(e) => setKey(e.target.value)} />
      )}
    </SettingsSection>
  );
}
