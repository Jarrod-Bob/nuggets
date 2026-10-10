import React from 'react';
import { api, describeError } from '../api';

/**
 * The kimi settings, shared by every look (kimi project-name design §3,
 * ADR 0002): the address of kimi-no-name-wa, fetched each time `open` turns
 * true. There is no on/off switch: when kimi isn't running, the form says so.
 */
export interface KimiSettingsModel {
  url: string;
  /** Editing the address clears the last "Saved." */
  changeUrl: (url: string) => void;
  save: () => void;
  notice: string | undefined;
  error: string | undefined;
  busy: boolean;
}

export function useKimiSettings(open: boolean): KimiSettingsModel {
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

  const changeUrl = (value: string) => {
    setUrl(value);
    setNotice(undefined);
  };

  return { busy, error, notice, save, changeUrl, url };
}
