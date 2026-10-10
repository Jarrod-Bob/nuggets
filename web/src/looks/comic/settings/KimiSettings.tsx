import { useKimiSettings } from '../../../models/useKimiSettings';
import { Button, Field } from '../ui';
import { SettingsSection } from './SettingsSection';

/**
 * The kimi section of the Comic Settings dialog: the address of
 * kimi-no-name-wa, which suggests project names in the nugget form. There is
 * no on/off switch and no status pill; a saved address says "Saved." instead.
 */
export function KimiSettings({ open }: { open: boolean }) {
  const { busy, error, notice, save, changeUrl, url } = useKimiSettings(open);

  return (
    <SettingsSection
      title="kimi"
      description="Suggest project names for nuggets with kimi-no-name-wa, running on this machine."
      error={error}
      actions={
        <>
          {notice && (
            <span role="status" className="comic-settings-saved">
              {notice}
            </span>
          )}
          <Button size="sm" onClick={save} disabled={busy}>
            Save
          </Button>
        </>
      }
    >
      <Field id="comic-kimi-address" label="kimi address" type="url" placeholder="http://127.0.0.1:7799" value={url} onChange={(e) => changeUrl(e.target.value)} />
    </SettingsSection>
  );
}
