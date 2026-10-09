import React from 'react';
import { Input } from '../forms/Input';
import { Button } from '../core/Button';
import { IconButton } from '../core/IconButton';
import { api, type KimiName } from '../../api';

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

type Results = { state: 'none' } | { state: 'failed' } | { state: 'names'; names: KimiName[] };

export function ProjectNameField({ value, onChange, notes, onPick }: ProjectNameFieldProps) {
  // null while the health check is in flight.
  const [available, setAvailable] = React.useState<boolean | null>(null);
  const [naming, setNaming] = React.useState<AbortController | null>(null);
  const [results, setResults] = React.useState<Results>({ state: 'none' });
  // Every name shown this form session, for Re-roll's avoid. A ref, not
  // state: nothing renders from it.
  const shown = React.useRef<string[]>([]);
  const inFlight = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    let live = true;
    api.kimi.available().then((ok) => {
      if (live) setAvailable(ok);
    });
    return () => {
      live = false;
      inFlight.current?.abort();
    };
  }, []);

  const ask = (avoid: string[]) => {
    const controller = new AbortController();
    inFlight.current = controller;
    setNaming(controller);
    api.kimi
      .names(notes.trim(), avoid, controller.signal)
      .then((names) => {
        shown.current = [...shown.current, ...names.map((n) => n.name)];
        setResults({ state: 'names', names });
      })
      .catch(() => {
        // A cancel leaves the list as it was; anything else is "not available".
        if (!controller.signal.aborted) setResults({ state: 'failed' });
      })
      .finally(() => {
        if (inFlight.current === controller) {
          inFlight.current = null;
          setNaming(null);
        }
      });
  };

  const cancel = () => {
    naming?.abort();
  };

  const notesEmpty = notes.trim() === '';
  const hint = notesEmpty ? NOTES_EMPTY_HINT : available === false ? UNAVAILABLE_TEXT : undefined;

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
        <div style={{ paddingTop: 23 }}>
          {naming ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 46 }}>
              <span role="status" style={{ fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-500)', whiteSpace: 'nowrap' }}>Naming…</span>
              <IconButton size="lg" variant="outline" label="Cancel naming" onClick={cancel}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </IconButton>
            </span>
          ) : (
            <IconButton size="lg" variant="outline" label={GENERATE_TOOLTIP} disabled={notesEmpty || available !== true} onClick={() => ask([])}>
              <span aria-hidden="true" style={{ fontSize: 18 }}>✨</span>
            </IconButton>
          )}
        </div>
      </div>

      {results.state === 'failed' && (
        <p role="status" style={{ margin: 0, fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-500)' }}>{UNAVAILABLE_TEXT}</p>
      )}

      {results.state === 'names' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ul role="listbox" aria-label="Names from kimi" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {results.names.map((n) => (
              <li key={n.name} role="option" aria-selected={value === n.name}
                tabIndex={0}
                onClick={() => onPick(n.name)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onPick(n.name);
                  }
                }}
                style={{
                  padding: '8px 12px', cursor: 'pointer', borderRadius: 'var(--radius-md)',
                  border: `var(--border-hairline) solid ${value === n.name ? 'var(--nug-golden-500)' : 'var(--nug-ink-200)'}`,
                  background: value === n.name ? 'var(--nug-cream-200)' : 'transparent',
                }}>
                <span style={{ display: 'block', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-body-md)' }}>{n.name}</span>
                <span style={{ display: 'block', fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-500)', textWrap: 'pretty' }}>{n.explanation}</span>
              </li>
            ))}
          </ul>
          <div>
            <Button variant="ghost" size="sm" disabled={!!naming || notesEmpty} onClick={() => ask(shown.current)}>Re-roll</Button>
          </div>
        </div>
      )}
    </div>
  );
}
