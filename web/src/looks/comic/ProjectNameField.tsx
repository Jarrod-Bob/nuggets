import { useKimiNames } from '../../models/useKimiNames';
import { Button, Field, IconButton } from './ui';

/**
 * The "Suggested project name" field and its sparkle button, which asks
 * kimi-no-name-wa (through nuggets' server) for five names from the notes.
 * The field is plain text: kimi only suggests. Same labels and accessible
 * names as Classic's ProjectNameField. Mounted only while the dialog is open,
 * so kimi's health is checked on open and closing aborts a call in flight.
 */
export interface ProjectNameFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** The form's current notes: what kimi names. */
  notes: string;
  /** A suggestion was picked. The form fills the field (and an empty title). */
  onPick: (name: string) => void;
}

const GENERATE_TOOLTIP = 'Uses kimi-no-name-wa to generate a creative name for your project!';
const NOTES_EMPTY_HINT = 'Write some notes and kimi will name it';
const UNAVAILABLE_TEXT = 'kimi is not available at the moment';

export function ProjectNameField({ value, onChange, notes, onPick }: ProjectNameFieldProps) {
  const kimi = useKimiNames({ notes, value });
  const hint = kimi.blocked === 'no-notes' ? NOTES_EMPTY_HINT : kimi.blocked === 'unavailable' ? UNAVAILABLE_TEXT : undefined;

  return (
    <div className="comic-namefield">
      <Field
        label="Suggested project name"
        placeholder="What would you call it?"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        hint={hint}
        action={
          kimi.naming ? (
            <IconButton label="Cancel naming" aria-busy className="comic-namefield-busy" onClick={kimi.cancel}>
              <span aria-hidden="true">✕</span>
            </IconButton>
          ) : (
            <IconButton label={GENERATE_TOOLTIP} disabled={kimi.blocked === 'no-notes' || kimi.available !== true} onClick={kimi.generate}>
              <span aria-hidden="true">✨</span>
            </IconButton>
          )
        }
      />

      {kimi.results.state === 'failed' && (
        <p role="status" className="comic-field-hint">
          {UNAVAILABLE_TEXT}
        </p>
      )}

      {kimi.results.state === 'names' && (
        <div className="comic-namefield-results">
          <div className="comic-namefield-names">
            <ul role="listbox" aria-label="Names from kimi" className="comic-namefield-list">
              {kimi.results.names.map((n) => (
                <li
                  key={n.name}
                  role="option"
                  aria-selected={value === n.name}
                  tabIndex={0}
                  className="comic-namefield-name"
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
                  {n.name}
                </li>
              ))}
            </ul>
            <Button size="sm" disabled={kimi.naming || kimi.blocked === 'no-notes'} onClick={kimi.reroll}>
              Re-roll
            </Button>
          </div>
          {/* A fixed two-line box, the same size empty or full, so hovering names never shifts the dialog. */}
          <p data-testid="kimi-explanation" className="comic-field-hint comic-namefield-why" style={{ height: 'calc(2 * 1.4em)' }}>
            {kimi.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
