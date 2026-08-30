import React from 'react';
import { Tag } from '../core/Tag';

/**
 * Freeform tag entry with autocomplete over tags already in use — the app's
 * one genuinely fiddly control.
 * Typing an unused name offers to create it; the input shows the normalised
 * form ("Saved as saas") so the lowercase rule is never a surprise. The server
 * owns normalisation — this only previews it.
 *
 * Keyboard: ↑/↓ move, Enter commits, Backspace on an empty input removes the
 * last tag, Escape closes.
 */
export interface TagComboboxProps {
  /** Currently selected tag names (already normalised). */
  value?: string[];
  /** Autocomplete source — `GET /api/tags`, filtered client-side. */
  options?: string[];
  onChange?: (tags: string[]) => void;
  label?: string;
  placeholder?: string;
  style?: React.CSSProperties;
}

type ComboRow = string | { create: string };

const normalise = (s: string) => s.trim().toLowerCase();

export function TagCombobox({ value = [], options = [], onChange, label = 'Tags', placeholder = 'Add a tag…', style }: TagComboboxProps) {
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [cursor, setCursor] = React.useState(0);
  const norm = normalise(q);
  const matches = options.filter(o => o.includes(norm) && !value.includes(o)).slice(0, 6);
  const isNew = norm.length > 0 && !options.includes(norm);
  const rows: ComboRow[] = isNew ? [...matches, { create: norm }] : matches;

  const add = (name: string) => { const n = normalise(name); if (n && !value.includes(n)) onChange && onChange([...value, n]); setQ(''); setCursor(0); };
  const key = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const r = rows[cursor]; if (r) add(typeof r === 'string' ? r : r.create); }
    else if (e.key === 'Backspace' && q === '' && value.length) { onChange && onChange(value.slice(0, -1)); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div style={{ position: 'relative', ...style }}>
      {label && <span style={{ display: 'block', marginBottom: 6, fontSize: 'var(--text-label)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--nug-ink-500)' }}>{label}</span>}
      <div style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, minHeight: 44, padding: '7px 10px',
        background: 'var(--nug-white)',
        border: `var(--border-regular) solid ${open ? 'var(--nug-golden-500)' : 'var(--nug-ink-200)'}`,
        borderRadius: 'var(--radius-md)', boxShadow: open ? 'var(--focus-shadow)' : 'none',
        transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
      }}>
        {value.map(t => <Tag key={t} name={t} onRemove={() => onChange && onChange(value.filter(x => x !== t))} />)}
        <input value={q} placeholder={value.length ? '' : placeholder}
          onChange={e => { setQ(e.target.value); setOpen(true); setCursor(0); }}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)} onKeyDown={key}
          style={{ flex: 1, minWidth: 90, height: 28, border: 'none', outline: 'none', background: 'transparent', font: 'inherit', fontSize: 'var(--text-body-md)', color: 'var(--text-body)' }} />
      </div>
      {q && norm !== q && (
        <div style={{ marginTop: 5, fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-500)' }}>
          Saved as <span style={{ fontFamily: 'var(--font-mono)' }}>{norm}</span>
        </div>
      )}
      {open && rows.length > 0 && (
        <div role="listbox" style={{
          position: 'absolute', zIndex: 40, top: '100%', left: 0, right: 0, marginTop: 6,
          background: 'var(--nug-white)', border: 'var(--border-regular) solid var(--nug-ink-200)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-2)', overflow: 'hidden', padding: 4,
        }}>
          {rows.map((r, i) => {
            const create = typeof r !== 'string';
            const name = create ? r.create : r;
            return (
              <div key={name + (create ? '-new' : '')} role="option" aria-selected={i === cursor}
                onMouseEnter={() => setCursor(i)} onMouseDown={e => { e.preventDefault(); add(name); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 'var(--radius-sm)',
                  background: i === cursor ? 'var(--nug-cream-200)' : 'transparent', cursor: 'pointer',
                  fontSize: 'var(--text-body-md)',
                }}>
                <Tag name={name} />
                {create && <span style={{ marginLeft: 'auto', fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-500)' }}>new tag</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
