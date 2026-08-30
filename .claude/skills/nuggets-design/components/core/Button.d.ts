import * as React from 'react';

/**
 * The primary Nuggets action control: pill-shaped, display type, with a flat
 * "crust edge" underneath that compresses on press.
 */
export interface ButtonProps {
  /** Visual weight. `primary` golden, `danger` ketchup, `secondary` outlined, `ghost` bare. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Button(props: ButtonProps): JSX.Element;
