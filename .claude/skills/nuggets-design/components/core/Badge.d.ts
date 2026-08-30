import * as React from 'react';

/** Small uppercase status pill — counts, states, "new", plan names. */
export interface BadgeProps {
  tone?: 'neutral' | 'golden' | 'ketchup' | 'herb' | 'ink';
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Badge(props: BadgeProps): JSX.Element;
