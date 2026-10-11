import React from 'react';
import { Dialog } from '../feedback/Dialog';
import { Button } from '../core/Button';
import { Input } from '../forms/Input';
import { Textarea } from '../forms/Textarea';
import { TagCombobox } from './TagCombobox';
import { ProjectNameField } from './ProjectNameField';
import { STATUSES } from '../../api';
import { statusLabel } from '../../lib/status';
import { useIdeaDraft, type DraftSource, type IdeaDraft } from '../../models/useIdeaDraft';

export type { IdeaDraft };

/**
 * The create/edit dialog — the only way an idea is written until the individual
 * nugget page lands. `PATCH` replaces the whole tag and link set, so the form
 * always submits the complete arrays. A blank title is rejected inline (the API
 * returns 400 for the same case); errors render in the field, not a toast.
 *
 * The project name is optional and free text; kimi only suggests values for
 * it. Picking a suggestion while the title is empty borrows the name for the
 * title too, the only time a project name is copied into the title.
 */
export interface IdeaFormProps {
  open?: boolean;
  mode?: 'create' | 'edit';
  /** Existing idea when editing. */
  idea?: DraftSource;
  /** Autocomplete source from `GET /api/tags`. */
  tagOptions?: string[];
  onSubmit?: (draft: IdeaDraft) => void;
  onClose?: () => void;
  /** Server-side error message, rendered under the title field. */
  error?: string;
  /** Told whether the open form holds edits that differ from what it opened with. */
  onDirtyChange?: (dirty: boolean) => void;
  /** A quiet line above the fields, e.g. that new nuggets arrived meanwhile. */
  notice?: string;
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

export function IdeaForm({ open = false, mode = 'create', idea, tagOptions = [], onSubmit, onClose, error, onDirtyChange, notice }: IdeaFormProps) {
  const draft = useIdeaDraft({ open, idea, error, onSubmit, onDirtyChange });

  return (
    <Dialog open={open} width={520} onClose={onClose}
      title={mode === 'create' ? 'Drop a nugget' : 'Edit nugget'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={draft.submit}>{mode === 'create' ? 'Drop it in' : 'Save'}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {notice && (
          <p role="status" style={{ margin: 0, fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-500)', textWrap: 'pretty' }}>{notice}</p>
        )}
        <Input label="Title" placeholder="What's the idea?" value={draft.title} onChange={e => draft.setTitle(e.target.value)} error={draft.message || undefined} />
        <ProjectNameField value={draft.projectName} onChange={draft.setProjectName} notes={draft.notes} onPick={draft.pickProjectName} />
        <Textarea label="Notes" rows={4} placeholder="Anything else worth remembering." value={draft.notes} onChange={e => draft.setNotes(e.target.value)} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={fieldLabelStyle}>Status</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {STATUSES.map((s) => (
              <button key={s} type="button" onClick={() => draft.setStatus(s)} style={statusChipStyle(draft.status === s)}>
                {statusLabel(s)}
              </button>
            ))}
          </div>
        </div>

        <TagCombobox value={draft.tags} options={tagOptions} onChange={draft.setTags} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={fieldLabelStyle}>Links</span>
          {draft.links.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Input placeholder="https://…" value={l.url} onChange={(e) => draft.setLinkAt(i, { url: e.target.value })} style={{ flex: 2 }} />
              <Input placeholder="Label (optional)" value={l.label} onChange={(e) => draft.setLinkAt(i, { label: e.target.value })} style={{ flex: 1 }} />
              <Button variant="ghost" size="sm" onClick={() => draft.removeLink(i)}>Remove</Button>
            </div>
          ))}
          <div>
            <Button variant="ghost" size="sm" onClick={draft.addLink}>Add a link</Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
