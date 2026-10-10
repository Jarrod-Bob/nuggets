import React from 'react';
import { Dialog, Icon, IconButton } from '../ui';
import { GitHubSettings } from './GitHubSettings';
import { KimiSettings } from './KimiSettings';
import { LookSettings } from './LookSettings';
import { SpicesSettings } from './SpicesSettings';
import { TagSuggestionSettings } from './TagSuggestionSettings';
import './settings.css';

/**
 * The Comic look's Settings entry point, a round button in the top bar. Like
 * Classic's it owns the dialog's open state, so any Comic view drops it into
 * its own top bar. The dialog is mounted only while open, which is what makes
 * each section fetch its status afresh each time it opens.
 */
export function SettingsButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <IconButton label="Settings" onClick={() => setOpen(true)}>
        <Icon name="settings" size={18} />
      </IconButton>
      {open && (
        <Dialog title="Settings" description="Where nuggets arrive from, and where they're sent." onClose={() => setOpen(false)}>
          <LookSettings open />
          <SpicesSettings open />
          <GitHubSettings open />
          <KimiSettings open />
          <TagSuggestionSettings open />
        </Dialog>
      )}
    </>
  );
}
