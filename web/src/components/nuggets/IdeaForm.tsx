import React from 'react';
import { Dialog } from '../feedback/Dialog';
import { Button } from '../core/Button';
import { Input } from '../forms/Input';
import { Textarea } from '../forms/Textarea';
import { TagCombobox } from './TagCombobox';
import { STATUSES, type Status, type Link } from '../../api';
import { statusLabel } from '../../lib/status';

export interface IdeaDraft { title: string; notes: string; tags: string[]; status: Status; links: Link[] }

/**
 * The create/edit dialog — the only way an idea is written until the individual
 * nugget page lands. `PATCH` replaces the whole tag and link set, so the form
 * always submits the complete arrays. A blank title is rejected inline (the API
 * returns 400 for the same case); errors render in the field, not a toast.
 */
export interface IdeaFormProps {
  open?: boolean;
  mode?: 'create' | 'edit';
  /** Existing idea when editing. */
  idea?: { title?: string; notes?: string; tags?: string[]; status?: Status; links?: Link[] };
  /** Autocomplete source from `GET /api/tags`. */
  tagOptions?: string[];
  onSubmit?: (draft: IdeaDraft) => void;
  onClose?: () => void;
  /** Server-side error message, rendered under the title field. */
  error?: string;
}

function statusChipStyle(active: boolean): React.CSSProperties {
  return {
    height: 28,
    padding: '0 12px',
    borderRadius: 'var(--radius-pill)',
    cursor: 'pointer',
    background: active ? 'var(--nug-ink-900)' : 'transparent',
    border: `var(--border-hairline) solid ${active ? 'var(--nug-ink-900)' : 'var(--nug-ink-200)'}`,
    color: active ? 'var(--nug-cream-50)' : 'var(--nug-ink-500)',
    font: 'inherit',
    fontSize: 'var(--text-body-sm)',
    fontWeight: 'var(--weight-semibold)',
    transition: 'all var(--dur-fast) var(--ease-out)',
  };
}

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 'var(--text-body-sm)',
  fontWeight: 'var(--weight-semibold)',
  color: 'var(--nug-ink-700)',
};

export function IdeaForm({ open = false, mode = 'create', idea, tagOptions = [], onSubmit, onClose, error }: IdeaFormProps) {
  const [title, setTitle] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [tags, setTags] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<Status>('raw');
  const [links, setLinks] = React.useState<Link[]>([]);
  const [local, setLocal] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    // Form state must reset whenever the dialog reopens with different props
    // (a fresh create, or editing a different idea) — this is the standard
    // dialog-reset pattern, not state that should be derived during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitle((idea && idea.title) || '');
    setNotes((idea && idea.notes) || '');
    setTags((idea && idea.tags) || []);
    setStatus((idea && idea.status) || 'raw');
    setLinks((idea && idea.links) ? idea.links.map((l) => ({ ...l })) : []);
    setLocal(null);
  }, [open, idea]);

  const setLinkAt = (i: number, patch: Partial<Link>) =>
    setLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLink = () => setLinks((prev) => [...prev, { url: '', label: '' }]);
  const removeLink = (i: number) => setLinks((prev) => prev.filter((_, idx) => idx !== i));

  const submit = () => {
    if (!title.trim()) { setLocal('A nugget needs a title.'); return; }
    // Drop blank rows; the server validates the rest and returns 400 on a bad URL.
    const cleaned = links
      .map((l) => ({ url: l.url.trim(), label: l.label.trim() }))
      .filter((l) => l.url !== '');
    onSubmit?.({ title: title.trim(), notes, tags, status, links: cleaned });
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={fieldLabelStyle}>Status</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {STATUSES.map((s) => (
              <button key={s} type="button" onClick={() => setStatus(s)} style={statusChipStyle(status === s)}>
                {statusLabel(s)}
              </button>
            ))}
          </div>
        </div>

        <TagCombobox value={tags} options={tagOptions} onChange={setTags} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={fieldLabelStyle}>Links</span>
          {links.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Input placeholder="https://…" value={l.url} onChange={(e) => setLinkAt(i, { url: e.target.value })} style={{ flex: 2 }} />
              <Input placeholder="Label (optional)" value={l.label} onChange={(e) => setLinkAt(i, { label: e.target.value })} style={{ flex: 1 }} />
              <Button variant="ghost" size="sm" onClick={() => removeLink(i)}>Remove</Button>
            </div>
          ))}
          <div>
            <Button variant="ghost" size="sm" onClick={addLink}>Add a link</Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
