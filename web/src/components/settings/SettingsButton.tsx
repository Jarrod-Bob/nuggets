import React from 'react';
import { IconButton } from '../core/IconButton';
import { iconSettings } from '../icons';
import { TelegramSettings } from './TelegramSettings';

/**
 * The top-bar entry point to settings (design §11: "reached from the top bar").
 * It owns the dialog's open state so any route can drop it into its own top bar
 * without threading that state through the route.
 */
export function SettingsButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <IconButton label="Settings" onClick={() => setOpen(true)}>
        {iconSettings}
      </IconButton>
      <TelegramSettings open={open} onClose={() => setOpen(false)} />
    </>
  );
}
