import React from 'react';
import { Button } from '../core/Button';
import { Input } from '../forms/Input';
import { api, ApiError } from '../../api';
import { SettingsSection } from './SettingsSection';

export interface KimiSettingsProps {
  /** Whether the settings dialog is showing: the address is fetched each time it opens. */
  open: boolean;
}

const describeError = (err: unknown): string => (err instanceof ApiError ? err.message : 'Something went wrong.');

/**
 * The kimi section of the settings dialog (kimi project-name design §3): the
 * address of kimi-no-name-wa, which suggests project names in the nugget
 * form. There is no on/off switch: when kimi isn't running, the form's button
 * says so.
 */
export function KimiSettings({ open }: KimiSettingsProps) {
  const [url, setUrl] = React.useState('');
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [notice, setNotice] = React.useState<string | undefined>(undefined);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let live = true;
    api.kimi
      .settings()
      .then((s) => {
        if (!live) return;
        setUrl(s.url);
        setError(undefined);
        setNotice(undefined);
      })
      .catch((err) => {
        if (live) setError(describeError(err));
      });
    return () => {
      live = false;
    };
  }, [open]);

  const save = () => {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    api.kimi
      .save({ url: url.trim() })
      .then((s) => {
        setUrl(s.url);
        setNotice('Saved.');
      })
      .catch((err) => setError(describeError(err)))
      .finally(() => setBusy(false));
  };

  return (
    <SettingsSection title="kimi" description="Suggest project names for nuggets with kimi-no-name-wa, running on this machine.">
      {error && (
        <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--nug-ketchup-100)', color: 'var(--nug-ketchup-600)', fontSize: 'var(--text-body-sm)' }}>
          {error}
        </div>
      )}
      <Input id="nug-in-kimi-address" label="kimi address" type="url" placeholder="http://127.0.0.1:7799" value={url}
        onChange={(e) => { setUrl(e.target.value); setNotice(undefined); }} />
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
        {notice && <span role="status" style={{ fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-500)' }}>{notice}</span>}
        <Button onClick={save} disabled={busy}>Save</Button>
      </div>
    </SettingsSection>
  );
}
