import { cx } from './cx';
import React from 'react';
import { Icon } from './Icon';

/** The pill-shaped search input. `label` is its accessible name (falls back to the placeholder); `onClear` shows a clear button once there is text. */
export interface SearchFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  onClear?: () => void;
}

export function SearchField({ label, onClear, className, ...rest }: SearchFieldProps) {
  return (
    <div className={cx('comic-search', className)}>
      <Icon name="search" />
      <input type="search" aria-label={label ?? rest.placeholder} {...rest} />
      {rest.value && onClear && (
        <button type="button" className="comic-search-clear" aria-label="Clear search" onClick={onClear}>
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}
