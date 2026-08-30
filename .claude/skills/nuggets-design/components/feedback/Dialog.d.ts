import * as React from 'react';

/** Centred modal: 2px ink border, 28px radius, warm blurred scrim. */
export interface DialogProps {
  open?: boolean;
  title: string;
  description?: string;
  onClose?: () => void;
  /** Buttons, right-aligned. */
  footer?: React.ReactNode;
  width?: number;
  children?: React.ReactNode;
}
export declare function Dialog(props: DialogProps): JSX.Element | null;
