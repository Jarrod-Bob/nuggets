import React from 'react';
import { Dialog } from '../feedback/Dialog';
import { Button } from '../core/Button';
import { Input } from '../forms/Input';
import { Textarea } from '../forms/Textarea';
import { TagCombobox } from './TagCombobox';

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

export function IdeaForm({ open = false, mode = 'create', idea, tagOptions = [], onSubmit, onClose, error }: IdeaFormProps) {
  const [title, setTitle] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [tags, setTags] = React.useState<string[]>([]);
  const [local, setLocal] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setTitle((idea && idea.title) || '');
    setNotes((idea && idea.notes) || '');
    setTags((idea && idea.tags) || []);
    setLocal(null);
  }, [open, idea]);

  const submit = () => {
    if (!title.trim()) { setLocal('A nugget needs a title.'); return; }
    onSubmit && onSubmit({ title: title.trim(), notes, tags });
  };
  const msg = local || error;

  return (
    <Dialog open={open} width={520} onClose={onClose}
      title={mode === 'create' ? 'Drop a nugget' : 'Edit nugget'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit}>{mode === 'create' ? 'Drop it in' : 'Save'}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Title" placeholder="What's the idea?" value={title} onChange={e => { setTitle(e.target.value); setLocal(null); }} error={msg || undefined} />
        <Textarea label="Notes" rows={4} placeholder="Anything else worth remembering." value={notes} onChange={e => setNotes(e.target.value)} />
        <TagCombobox value={tags} options={tagOptions} onChange={setTags} />
      </div>
    </Dialog>
  );
}
