import * as React from 'react';

/** Generic surface container. `NuggetCard` is the specialised idea version. */
export interface CardProps {
  tone?: 'plain' | 'cream' | 'sunken' | 'ink';
  padding?: number | string;
  /** Adds the hover lift and pointer cursor. */
  interactive?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Card(props: CardProps): JSX.Element;
