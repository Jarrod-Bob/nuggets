import React from 'react';

/** Single-line text field with an uppercase micro-label above it. */
export interface InputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: 'text' | 'email' | 'password' | 'search' | 'url' | 'number';
  hint?: string;
  /** Replaces `hint` and turns the border ketchup. */
  error?: string;
  disabled?: boolean;
  iconLeft?: React.ReactNode;
  id?: string;
  style?: React.CSSProperties;
}

export function Input({ label, placeholder, value, onChange, type = 'text', hint, error, disabled = false, iconLeft, id, style }: InputProps) {
  const [focus, setFocus] = React.useState(false);
  const fid = id || `nug-in-${label ? label.replace(/\s+/g, '-').toLowerCase() : 'field'}`;
  return (
    <label htmlFor={fid} style={{ display: 'block', ...style }}>
      {label && <span style={{ display: 'block', marginBottom: 6, fontSize: 'var(--text-label)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--nug-ink-500)' }}>{label}</span>}
      <span style={{
        display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 14px',
        background: disabled ? 'var(--nug-cream-200)' : 'var(--nug-white)',
        border: `var(--border-regular) solid ${error ? 'var(--nug-ketchup-500)' : focus ? 'var(--nug-golden-500)' : 'var(--nug-ink-200)'}`,
        borderRadius: 'var(--radius-md)',
        boxShadow: focus ? 'var(--focus-shadow)' : 'none',
        transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
      }}>
        {iconLeft && <span style={{ color: 'var(--nug-ink-300)', display: 'flex' }}>{iconLeft}</span>}
        <input id={fid} type={type} value={value} placeholder={placeholder} disabled={disabled}
          onChange={onChange} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', font: 'inherit', fontSize: 'var(--text-body-md)', color: 'var(--text-body)' }} />
      </span>
      {(hint || error) && <span style={{ display: 'block', marginTop: 5, fontSize: 'var(--text-body-sm)', color: error ? 'var(--nug-ketchup-600)' : 'var(--nug-ink-500)' }}>{error || hint}</span>}
    </label>
  );
}
