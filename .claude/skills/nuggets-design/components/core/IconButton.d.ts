import * as React from 'react';

/** A round, icon-only control for toolbars, card corners and the mobile app bar. */
export interface IconButtonProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'outline' | 'filled';
  /** Required — becomes both aria-label and tooltip. */
  label: string;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;
