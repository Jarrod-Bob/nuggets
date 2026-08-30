import React from 'react';

/** Multi-line field for nugget bodies and notes. */
export interface TextareaProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  hint?: string;
  disabled?: boolean;
  id?: string;
  style?: React.CSSProperties;
}

export function Textarea({ label, placeholder, value, onChange, rows = 4, hint, disabled = false, id, style }: TextareaProps) {
  const [focus, setFocus] = React.useState(false);
  const fid = id || 'nug-ta';
  return (
    <label htmlFor={fid} style={{ display: 'block', ...style }}>
      {label && <span style={{ display: 'block', marginBottom: 6, fontSize: 'var(--text-label)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--nug-ink-500)' }}>{label}</span>}
      <textarea id={fid} rows={rows} value={value} placeholder={placeholder} disabled={disabled}
        onChange={onChange} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{
          display: 'block', width: '100%', padding: '12px 14px', resize: 'vertical',
          font: 'inherit', fontSize: 'var(--text-body-md)', lineHeight: 'var(--leading-normal)', color: 'var(--text-body)',
          background: disabled ? 'var(--nug-cream-200)' : 'var(--nug-white)',
          border: `var(--border-regular) solid ${focus ? 'var(--nug-golden-500)' : 'var(--nug-ink-200)'}`,
          borderRadius: 'var(--radius-md)', outline: 'none',
          boxShadow: focus ? 'var(--focus-shadow)' : 'none',
          transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
        }} />
      {hint && <span style={{ display: 'block', marginTop: 5, fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-500)' }}>{hint}</span>}
    </label>
  );
}
