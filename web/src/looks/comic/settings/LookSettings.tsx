import React from 'react';
import type { Look } from '../../look';
import { useLookSetting } from '../../../models/useLookSetting';
import { ActionError, CardArt, Icon } from '../ui';

const OPTIONS: ReadonlyArray<{ look: Look; name: string; label: string; tilt: number; inProgress?: boolean }> = [
  { look: 'classic', name: 'Classic', label: 'Classic', tilt: -2 },
  { look: 'comic', name: 'Comic', label: 'Comic (in progress)', tilt: 2, inProgress: true },
];

/** What each tile shows of its Look: a plain grey-lined card for Classic, a drawn nugget for Comic. */
function LookArt({ look }: { look: Look }) {
  return (
    <span className="comic-look-art" aria-hidden="true">
      {look === 'comic' ? (
        <CardArt shape={3} status="exploring" />
      ) : (
        <svg viewBox="0 0 74 54">
          <rect x="3" y="3" width="68" height="48" rx="6" fill="#fff" stroke="#b9b4ae" strokeWidth="2" />
          <path d="M13 17h30M13 27h48M13 37h36" stroke="#cfcac4" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

/**
 * The Look picker at the top of the Comic Settings dialog (ADR 0002): Classic
 * and Comic as two tilted sticker tiles, each a real radio in a group
 * labelled "Look". Choosing one saves it and switches the page at once.
 */
export function LookSettings({ open }: { open: boolean }) {
  const { look, choose, error, busy } = useLookSetting(open);
  const legendId = React.useId();
  const name = `look-${legendId}`;

  return (
    <section className="comic-look">
      <p id={legendId} className="comic-look-legend">
        Look
      </p>
      <ActionError message={error} />
      <div role="radiogroup" aria-labelledby={legendId} className="comic-look-tiles">
        {OPTIONS.map((option) => {
          const on = look === option.look;
          return (
            <label key={option.look} className={`comic-look-tile${on ? ' comic-look-tile--on' : ''}`} style={{ '--comic-tilt': `${option.tilt}deg` } as React.CSSProperties}>
              <input
                type="radio"
                name={name}
                className="comic-look-radio"
                aria-label={option.label}
                checked={on}
                disabled={look === undefined}
                // Stay enabled while saving so keyboard focus isn't dropped; a second choice waits for the first.
                onChange={() => !busy && choose(option.look)}
              />
              <LookArt look={option.look} />
              <span className="comic-look-name">
                {option.name}
                {on && <Icon name="check" size={16} />}
              </span>
              {option.inProgress && <span className="comic-look-note">In progress</span>}
            </label>
          );
        })}
      </div>
      <p className="comic-look-hint">How nuggets look. It applies at once. Comic is still being drawn, so some screens still show Classic.</p>
    </section>
  );
}
