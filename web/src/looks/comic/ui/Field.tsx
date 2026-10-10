import React from 'react';

/** A labelled text input or textarea with an optional hint. The label is wired with `htmlFor`, the hint with `aria-describedby`. */
export interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement & HTMLTextAreaElement>, 'children'> {
  label: React.ReactNode;
  /** Help or a literal error. */
  hint?: React.ReactNode;
  /** Render a textarea. */
  multiline?: boolean;
  /** A control at the end of the input row, such as a Button. */
  action?: React.ReactNode;
}

export function Field({ label, hint, multiline, action, id, className, style, ...rest }: FieldProps) {
  const auto = React.useId();
  const inputId = id ?? auto;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const props = { id: inputId, 'aria-describedby': hintId, className: 'comic-field-input', ...rest };
  const input = multiline ? <textarea {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} /> : <input {...props} />;
  return (
    <div className={['comic-field', className].filter(Boolean).join(' ')} style={style}>
      <label className="comic-field-label" htmlFor={inputId}>
        {label}
      </label>
      {action ? (
        <div className="comic-field-row">
          {input}
          {action}
        </div>
      ) : (
        input
      )}
      {hint && (
        <p id={hintId} className="comic-field-hint">
          {hint}
        </p>
      )}
    </div>
  );
}
