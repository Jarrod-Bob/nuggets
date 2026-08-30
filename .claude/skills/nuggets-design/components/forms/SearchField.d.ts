import * as React from 'react';

/** Pill search field. Sits in the topbar of the web app and above the nugget wall. */
export interface SearchFieldProps {
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear?: () => void;
  style?: React.CSSProperties;
}
export declare function SearchField(props: SearchFieldProps): JSX.Element;
