import React from 'react';

/** A filter toggle (status or tag). `pressed` fills it ink; it reports the state with `aria-pressed`. Children are the label, e.g. "#saas" or "All". */
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean;
}

export function Chip({ pressed = false, className, children, type = 'button', ...rest }: ChipProps) {
  return (
    <button type={type} aria-pressed={pressed} className={['comic-chip', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </button>
  );
}

/** A tag on a card: lowercase mono with a hash. Display only. */
export function Tag({ name }: { name: string }) {
  return <span className="comic-tag">#{name.toLowerCase()}</span>;
}
