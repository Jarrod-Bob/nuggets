import * as React from 'react';

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
export declare function Textarea(props: TextareaProps): JSX.Element;
