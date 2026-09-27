import React from 'react';
import { IconButton } from '../core/IconButton';
import { Dialog } from '../feedback/Dialog';
import { iconSettings } from '../icons';
import { SpicesSettings } from './SpicesSettings';

/**
 * The top-bar entry point to settings (design §11: "reached from the top bar").
 * It owns the dialog's open state so any route can drop it into its own top bar
 * without threading that state through the route. The dialog overlays whichever
 * route you are on rather than navigating away from it, and holds one section
 * per capture source: today only spices.
 */
export function SettingsButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <IconButton label="Settings" onClick={() => setOpen(true)}>
        {iconSettings}
      </IconButton>
      <Dialog open={open} title="Settings" description="Where nuggets arrive from, besides this screen." onClose={() => setOpen(false)} width={540}>
        <div style={{ maxHeight: '70vh', overflowY: 'auto', marginRight: -8, paddingRight: 8 }}>
          <SpicesSettings open={open} />
        </div>
      </Dialog>
    </>
  );
}
