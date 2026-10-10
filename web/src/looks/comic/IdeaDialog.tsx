import './idea-dialog.css';
import { STATUSES, statusLabel } from '../../lib/status';
import { useIdeaDraft, type DraftSource, type IdeaDraft } from '../../models/useIdeaDraft';
import { ProjectNameField } from './ProjectNameField';
import { TagField } from './TagField';
import { Button, Chip, Dialog, Field } from './ui';

export type { IdeaDraft };

/**
 * The Comic create/edit dialog: "Drop a nugget" and "Edit nugget". Same props,
 * labels and accessible names as Classic's IdeaForm, driven by the same
 * `useIdeaDraft` (ADR 0002), so the form's tests pass against both. Pass
 * `open`; it renders nothing while closed and resets whenever it opens or
 * opens on a different nugget. Escape and the scrim go to `onClose` through the
 * kit Dialog. Uses only the draft and kimi hooks, never the api.
 */
export interface IdeaDialogProps {
  open?: boolean;
  mode?: 'create' | 'edit';
  /** The nugget being edited. */
  idea?: DraftSource;
  /** Autocomplete source for tags (`GET /api/tags`). */
  tagOptions?: string[];
  onSubmit?: (draft: IdeaDraft) => void;
  onClose?: () => void;
  /** The server's complaint about the last submit, shown under the title. */
  error?: string;
  /** Told whether the open dialog holds edits that differ from what it opened with. */
  onDirtyChange?: (dirty: boolean) => void;
  /** A quiet line above the fields, e.g. that new nuggets arrived meanwhile. */
  notice?: string;
}

export function IdeaDialog({ open = false, mode = 'create', idea, tagOptions = [], onSubmit, onClose, error, onDirtyChange, notice }: IdeaDialogProps) {
  const draft = useIdeaDraft({ open, idea, error, onSubmit, onDirtyChange });
  if (!open) return null;

  return (
    <Dialog
      width={560}
      title={mode === 'create' ? 'Drop a nugget' : 'Edit nugget'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="tomato" onClick={draft.submit}>
            {mode === 'create' ? 'Drop it in' : 'Save'}
          </Button>
        </>
      }
    >
      {notice && (
        <p role="status" className="comic-field-hint">
          {notice}
        </p>
      )}
      <Field label="Title" placeholder="What's the idea?" value={draft.title} onChange={(e) => draft.setTitle(e.target.value)} hint={draft.message || undefined} aria-invalid={draft.message ? true : undefined} />
      <ProjectNameField value={draft.projectName} onChange={draft.setProjectName} notes={draft.notes} onPick={draft.pickProjectName} />
      <Field label="Notes" multiline placeholder="Anything else worth remembering." value={draft.notes} onChange={(e) => draft.setNotes(e.target.value)} />

      <div className="comic-field">
        <span className="comic-field-label" id="comic-idea-status">
          Status
        </span>
        <div role="group" aria-labelledby="comic-idea-status" className="comic-idea-chips">
          {STATUSES.map((s) => (
            <Chip key={s} pressed={draft.status === s} onClick={() => draft.setStatus(s)}>
              {statusLabel(s)}
            </Chip>
          ))}
        </div>
      </div>

      <TagField value={draft.tags} options={tagOptions} onChange={draft.setTags} />

      <div className="comic-field">
        <span className="comic-field-label">Links</span>
        {draft.links.map((l, i) => (
          <div key={i} className="comic-idea-link">
            <input className="comic-field-input" aria-label="Link URL" placeholder="https://…" value={l.url} onChange={(e) => draft.setLinkAt(i, { url: e.target.value })} />
            <input className="comic-field-input" aria-label="Link label" placeholder="Label (optional)" value={l.label} onChange={(e) => draft.setLinkAt(i, { label: e.target.value })} />
            <Button size="sm" onClick={() => draft.removeLink(i)}>
              Remove
            </Button>
          </div>
        ))}
        <div>
          <Button size="sm" icon="plus" onClick={draft.addLink}>
            Add a link
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
