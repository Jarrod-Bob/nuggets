import React from 'react';
import { Icon } from './ui';

/**
 * The Comic tag entry: freeform tags with autocomplete over the tags already
 * in use, the same behaviour and keys as Classic's TagCombobox. Typing an
 * unused name offers to create it, and "Saved as" previews the lowercase form
 * the server will store. Keys: up/down move, Enter commits, Backspace on an
 * empty input removes the last tag, Escape closes the list (the dialog stays).
 */
export interface TagFieldProps {
  /** Selected tag names, already normalised. */
  value: string[];
  /** Autocomplete source: the tags in use. */
  options: string[];
  onChange: (tags: string[]) => void;
}

type Row = string | { create: string };

const normalise = (s: string) => s.trim().toLowerCase();

export function TagField({ value, options, onChange }: TagFieldProps) {
  const id = React.useId();
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [cursor, setCursor] = React.useState(0);
  const norm = normalise(q);
  const matches = options.filter((o) => o.includes(norm) && !value.includes(o)).slice(0, 6);
  const isNew = norm.length > 0 && !options.includes(norm) && !value.includes(norm);
  const rows: Row[] = isNew ? [...matches, { create: norm }] : matches;

  const add = (name: string) => {
    const n = normalise(name);
    if (n && !value.includes(n)) onChange([...value, n]);
    setQ('');
    setCursor(0);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = rows[cursor];
      if (r) add(typeof r === 'string' ? r : r.create);
    } else if (e.key === 'Backspace' && q === '' && value.length) {
      onChange(value.slice(0, -1));
    } else if (e.key === 'Escape' && open && rows.length > 0) {
      // Close the list; preventDefault tells the dialog's Escape to leave it be.
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className="comic-field comic-tagfield">
      <label className="comic-field-label" htmlFor={`${id}-input`}>
        Tags
      </label>
      <div className="comic-tagfield-box">
        {value.map((t) => (
          <span key={t} className="comic-tagfield-tag">
            #{t}
            <button type="button" className="comic-tagfield-remove" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>
              <Icon name="close" size={12} />
            </button>
          </span>
        ))}
        <input
          id={`${id}-input`}
          className="comic-tagfield-input"
          value={q}
          placeholder={value.length ? '' : 'Add a tag…'}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setCursor(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
      </div>
      {q && norm !== q && (
        <p className="comic-field-hint">
          Saved as <span className="comic-tag">{norm}</span>
        </p>
      )}
      {open && rows.length > 0 && (
        <div role="listbox" aria-label="Tag suggestions" className="comic-tagfield-list">
          {rows.map((r, i) => {
            const create = typeof r !== 'string';
            const name = create ? r.create : r;
            return (
              <div
                key={name + (create ? '-new' : '')}
                role="option"
                aria-selected={i === cursor}
                className="comic-tagfield-option"
                onMouseEnter={() => setCursor(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(name);
                }}
              >
                <span className="comic-tag">#{name}</span>
                {create && <span className="comic-tagfield-new">new tag</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
