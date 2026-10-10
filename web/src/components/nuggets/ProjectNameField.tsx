import React from 'react';
import { Input } from '../forms/Input';
import { Button } from '../core/Button';
import { IconButton } from '../core/IconButton';
import { useKimiNames } from '../../models/useKimiNames';

/**
 * The form's "Suggested project name" field and its ✨ button, which asks
 * kimi-no-name-wa (through nuggets' server) for five names from the notes
 * (kimi project-name design §5). The field is plain text: kimi only suggests.
 *
 * Mounted only while the form is open, so kimi's health is checked when the
 * form opens, and the suggestions and the names already shown are discarded
 * when it closes. Closing it mid-request aborts the call.
 */
export interface ProjectNameFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** The form's current notes: what kimi names. */
  notes: string;
  /** A suggestion was clicked. The form fills the field (and an empty title). */
  onPick: (name: string) => void;
}

export const GENERATE_TOOLTIP = 'Uses kimi-no-name-wa to generate a creative name for your project!';
export const NOTES_EMPTY_HINT = 'Write some notes and kimi will name it';
export const UNAVAILABLE_TEXT = 'kimi is not available at the moment';

// A 3px arc, fading in from transparent, cut out of a disc just outside the
// button by a radial mask. Spun by the .nug-spin class (motion.css).
const RING_GAP = 5;
const spinRingStyle: React.CSSProperties = {
  position: 'absolute', inset: -RING_GAP, borderRadius: '50%', pointerEvents: 'none',
  background: 'conic-gradient(from 0deg, transparent 0 30%, var(--nug-golden-300) 60%, var(--nug-golden-500) 100%)',
  mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
  WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
};

function chipStyle(picked: boolean): React.CSSProperties {
  return {
    padding: '4px 12px', cursor: 'pointer', borderRadius: 'var(--radius-pill)',
    fontSize: 'var(--text-body-sm)', fontWeight: 'var(--weight-semibold)',
    border: `var(--border-hairline) solid ${picked ? 'var(--nug-golden-500)' : 'var(--nug-ink-200)'}`,
    background: picked ? 'var(--nug-cream-200)' : 'transparent',
  };
}

export function ProjectNameField({ value, onChange, notes, onPick }: ProjectNameFieldProps) {
  const kimi = useKimiNames({ notes, value });
  const hint = kimi.blocked === 'no-notes' ? NOTES_EMPTY_HINT : kimi.blocked === 'unavailable' ? UNAVAILABLE_TEXT : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <Input
          id="nug-in-project-name"
          label="Suggested project name"
          placeholder="What would you call it?"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          hint={hint}
          style={{ flex: 1 }}
        />
        {/* Reserves the busy ring's width on the right at all times, so the
            dialog's scrolling body doesn't clip it and nothing shifts when it appears. */}
        <div style={{ paddingTop: 23, paddingRight: RING_GAP }}>
          {kimi.naming ? (
            <CancelNaming onCancel={kimi.cancel} />
          ) : (
            <IconButton size="lg" variant="outline" label={GENERATE_TOOLTIP} disabled={kimi.blocked === 'no-notes' || kimi.available !== true} onClick={kimi.generate}>
              <span aria-hidden="true" style={{ fontSize: 18 }}>✨</span>
            </IconButton>
          )}
        </div>
      </div>

      {kimi.results.state === 'failed' && (
        <p role="status" style={{ margin: 0, fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-500)' }}>{UNAVAILABLE_TEXT}</p>
      )}

      {kimi.results.state === 'names' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <ul role="listbox" aria-label="Names from kimi" style={{ listStyle: 'none', margin: 0, padding: 0, flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {kimi.results.names.map((n) => (
                <li key={n.name} role="option" aria-selected={value === n.name}
                  tabIndex={0}
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
                  style={chipStyle(value === n.name)}>
                  {n.name}
                </li>
              ))}
            </ul>
            <Button variant="ghost" size="sm" disabled={kimi.naming || kimi.blocked === 'no-notes'} onClick={kimi.reroll}>Re-roll</Button>
          </div>
          {/* A fixed two-line box, the same size empty or full, so hovering
              names never shifts the form. Longer explanations are clamped. */}
          <p data-testid="kimi-explanation" style={{
            margin: 0, height: 'calc(2 * var(--leading-normal) * 1em)', lineHeight: 'var(--leading-normal)', overflow: 'hidden',
            display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2,
            fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-500)', textWrap: 'pretty',
          }}>
            {kimi.explanation}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * The busy button: a golden arc spins around it while kimi works, and the
 * button itself cancels, showing ✕ when hovered or focused. Mounted only while
 * naming, so the ✕ never carries over to the next request.
 */
function CancelNaming({ onCancel }: { onCancel: () => void }) {
  const [cancelShown, setCancelShown] = React.useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setCancelShown(true)} onMouseLeave={() => setCancelShown(false)}
      onFocus={() => setCancelShown(true)} onBlur={() => setCancelShown(false)}>
      <span aria-hidden="true" className="nug-spin" style={spinRingStyle} />
      <IconButton size="lg" variant="outline" label="Cancel naming" busy onClick={onCancel}>
        {cancelShown
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          : <span aria-hidden="true" style={{ fontSize: 18 }}>✨</span>}
      </IconButton>
    </span>
  );
}
