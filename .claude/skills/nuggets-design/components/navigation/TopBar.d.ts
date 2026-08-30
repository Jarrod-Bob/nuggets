import * as React from 'react';

/**
 * The app's only piece of chrome: 60px header with the wordmark, the search
 * box, and the actions on the right (draw a nugget, trash toggle, new nugget).
 * There is no sidebar and no tab bar — the MVP is one screen plus two dialogs.
 */
export interface TopBarProps {
  /** Usually the `SearchField`. */
  center?: React.ReactNode;
  right?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function TopBar(props: TopBarProps): JSX.Element;
