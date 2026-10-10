import { cx } from './cx';
import React from 'react';

/**
 * A round, icon-only button. `label` is required: it is both the accessible
 * name and the tooltip.
 */
export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> {
  label: string;
  /** The icon, usually an `<Icon>`. */
  children: React.ReactNode;
}

export function IconButton({ label, className, children, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button type={type} aria-label={label} title={label} className={cx('comic-round', className)} {...rest}>
      {children}
    </button>
  );
}
