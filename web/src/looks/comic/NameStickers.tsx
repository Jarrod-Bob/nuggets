import './names.css';
import React from 'react';
import { useKimiNames } from '../../models/useKimiNames';
import { Button, cx, Field, Icon } from './ui';

/**
 * The form's "Suggested project name" field in the Comic look: a dice pill that
 * asks kimi-no-name-wa (through nuggets' server) for five names from the
 * notes, the names as tilted stickers, and a two-line box saying why the
 * pointed-at name was suggested. The field is plain text: kimi only suggests.
 * Same props, labels and accessible names as Classic's field, driven by the
 * same `useKimiNames` model.
 *
 * Mount it only while the form is open, so kimi's health is checked when the
 * form opens, and the names shown are discarded when it closes. Closing it
 * mid-request aborts the call.
 *
 * Not mounted yet: the Comic edit and drop dialog (#54) has a simpler field of
 * its own. Swapping this in there is the follow-up once #53 and #54 are in.
 */
export interface NameStickersProps {
  value: string;
  onChange: (value: string) => void;
  /** The form's current notes: what kimi names. */
  notes: string;
  /** A sticker was picked. The form fills the field (and an empty title). */
  onPick: (name: string) => void;
}

const GENERATE_TOOLTIP = 'Uses kimi-no-name-wa to generate a creative name for your project!';
const NOTES_EMPTY_HINT = 'Write some notes and kimi will name it';
const UNAVAILABLE_TEXT = 'kimi is not available at the moment';

/** Each sticker is peeled on at its own angle, by its place in the row. */
const STICKER_TILTS = [-3, 2, -2, 3, -1.5];

export function NameStickers({ value, onChange, notes, onPick }: NameStickersProps) {
  const kimi = useKimiNames({ notes, value });
  const hint = kimi.blocked === 'no-notes' ? NOTES_EMPTY_HINT : kimi.blocked === 'unavailable' ? UNAVAILABLE_TEXT : undefined;
  const names = kimi.results.state === 'names';

  let pill: React.ReactNode;
  if (kimi.naming) {
    pill = (
      <Button size="sm" className="comic-dice comic-dice--rolling" icon="dice" aria-label="Cancel naming" aria-busy onClick={kimi.cancel}>
        Stop
      </Button>
    );
  } else if (names) {
    pill = (
      <Button size="sm" className="comic-dice" icon="dice" disabled={kimi.blocked === 'no-notes'} onClick={kimi.reroll}>
        Re-roll
      </Button>
    );
  } else {
    pill = (
      <Button
        size="sm"
        className="comic-dice"
        icon="dice"
        title={GENERATE_TOOLTIP}
        aria-label={`Roll names: ${GENERATE_TOOLTIP}`}
        disabled={kimi.blocked === 'no-notes' || kimi.available !== true}
        onClick={kimi.generate}
      >
        Roll names
      </Button>
    );
  }

  return (
    <div className="comic-names">
      <Field
        id="nug-in-project-name"
        label="Suggested project name"
        placeholder="What would you call it?"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        hint={hint}
        action={pill}
      />

      {kimi.results.state === 'failed' && (
        <p role="status" className="comic-names-status">
          {UNAVAILABLE_TEXT}
        </p>
      )}

      {kimi.results.state === 'names' && (
        <div className="comic-names-box">
          <ul role="listbox" aria-label="Names from kimi" className="comic-stickers">
            {kimi.results.names.map((n, i) => {
              const picked = value === n.name;
              return (
                <li
                  key={n.name}
                  role="option"
                  aria-selected={picked}
                  tabIndex={0}
                  className={cx('comic-sticker', picked && 'comic-sticker--picked')}
                  style={{ '--comic-tilt': `${STICKER_TILTS[i % STICKER_TILTS.length]}deg` } as React.CSSProperties}
                  onClick={() => onPick(n.name)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onPick(n.name);
                    }
                  }}
                  onMouseEnter={() => kimi.point(n.name)}
                  onMouseLeave={() => kimi.point(null)}
                  onFocus={() => kimi.point(n.name)}
                  onBlur={() => kimi.point(null)}
                >
                  <span>{n.name}</span>
                  {picked && <Icon name="check" size={16} />}
                </li>
              );
            })}
          </ul>
          {/* A fixed two-line box, the same size empty or full, so pointing at names never shifts the dialog. Longer explanations are clamped. */}
          <p data-testid="kimi-explanation" className="comic-names-why" style={{ height: 'calc(2 * 1.4 * 1em)', lineHeight: 1.4 }}>
            {kimi.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
