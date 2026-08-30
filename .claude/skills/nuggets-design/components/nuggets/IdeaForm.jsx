import React from 'react';
import { Dialog } from '../feedback/Dialog.jsx';
import { Button } from '../core/Button.jsx';
import { Input } from '../forms/Input.jsx';
import { Textarea } from '../forms/Textarea.jsx';
import { TagCombobox } from './TagCombobox.jsx';

export function IdeaForm({ open = false, mode = 'create', idea, tagOptions = [], onSubmit, onClose, error }) {
  const [title, setTitle] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [tags, setTags] = React.useState([]);
  const [local, setLocal] = React.useState(null);

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
