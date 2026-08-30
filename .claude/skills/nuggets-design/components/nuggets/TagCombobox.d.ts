import * as React from 'react';

/**
 * Freeform tag entry with autocomplete over tags already in use — the app's
 * one genuinely fiddly control (shadcn Command + Popover in the real build).
 * Typing an unused name offers to create it; the input shows the normalised
 * form ("Saved as saas") so the lowercase rule is never a surprise. The server
 * owns normalisation — this only previews it.
 *
 * Keyboard: ↑/↓ move, Enter commits, Backspace on an empty input removes the
 * last tag, Escape closes.
 */
export interface TagComboboxProps {
  /** Currently selected tag names (already normalised). */
  value?: string[];
  /** Autocomplete source — `GET /api/tags`, filtered client-side. */
  options?: string[];
  onChange?: (tags: string[]) => void;
  label?: string;
  placeholder?: string;
  style?: React.CSSProperties;
}
export declare function TagCombobox(props: TagComboboxProps): JSX.Element;
