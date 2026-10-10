import React from 'react';
import { Icon, type IconName } from './Icon';

/**
 * The Comic look's only button shape (the design's Pill). Presentational: it
 * takes every `<button>` attribute and calls whatever handlers it is given.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** `paper` (default); `tomato` for the page's primary action; `ink` for a selected state; `danger` (red-ink outline) for what can't be undone. */
  variant?: 'paper' | 'tomato' | 'ink' | 'danger';
  /** `lg` for the single call to action on a page; `sm` inside cards, caption boxes and sections. */
  size?: 'sm' | 'md' | 'lg';
  /** Icon before the label. */
  icon?: IconName;
  /** Icon after the label. */
  iconAfter?: IconName;
}

export function Button({ variant = 'paper', size = 'md', icon, iconAfter, className, children, type = 'button', ...rest }: ButtonProps) {
  const cls = ['comic-pill', `comic-pill--${variant}`, size !== 'md' && `comic-pill--${size}`, className].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
      {iconAfter && <Icon name={iconAfter} />}
    </button>
  );
}
