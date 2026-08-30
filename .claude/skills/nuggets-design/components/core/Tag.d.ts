import * as React from 'react';

/**
 * A freeform tag. Tag names are normalised server-side to trimmed lowercase, so
 * always render them lowercase here too. The dot colour is derived
 * deterministically from the name via `dipFor` — the same tag is always the
 * same dip colour, with no colour stored anywhere.
 */
export interface TagProps {
  /** The normalised tag name. Preferred over `children`. */
  name?: string;
  /** Override the derived dip colour. Rarely needed. */
  dip?: 'mustard' | 'bbq' | 'chilli' | 'herb' | 'curry' | 'ranch';
  /** Usage count, shown in mono — used in the tag filter. */
  count?: number;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Tag(props: TagProps): JSX.Element;
/** Deterministic dip colour for a tag name. */
export declare function dipFor(name: string): 'mustard' | 'bbq' | 'chilli' | 'herb' | 'curry' | 'ranch';
