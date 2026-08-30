import * as React from 'react';

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
export declare function Input(props: InputProps): JSX.Element;
