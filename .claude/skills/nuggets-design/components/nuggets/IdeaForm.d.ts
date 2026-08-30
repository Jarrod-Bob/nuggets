import * as React from 'react';

export interface IdeaDraft { title: string; notes: string; tags: string[] }

/**
 * The create/edit dialog — the only way an idea is written. `PATCH` replaces the
 * whole tag set, so the form always submits the complete array.
 * A blank title is rejected inline (the API returns 400 for the same case);
 * errors render in the field, not in a toast — the app has no toast system.
 */
export interface IdeaFormProps {
  open?: boolean;
  mode?: 'create' | 'edit';
  /** Existing idea when editing. */
  idea?: { title?: string; notes?: string; tags?: string[] };
  /** Autocomplete source from `GET /api/tags`. */
  tagOptions?: string[];
  onSubmit?: (draft: IdeaDraft) => void;
  onClose?: () => void;
  /** Server-side error message, rendered under the title field. */
  error?: string;
}
export declare function IdeaForm(props: IdeaFormProps): JSX.Element;
