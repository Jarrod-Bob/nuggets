import React from 'react';
import type { Link, Status } from '../api';

export interface IdeaDraft { title: string; notes: string; tags: string[]; status: Status; links: Link[]; project_name: string }

/** What the form opens with when editing; every field optional. */
export type DraftSource = { title?: string; notes?: string; tags?: string[]; status?: Status; links?: Link[]; project_name?: string };

/**
 * The create/edit form's fields, shared by every look (ADR 0002). They reset
 * whenever the form opens, or opens on a different nugget. `PATCH` replaces
 * the whole tag and link set, so a submit always hands over the complete
 * arrays. A blank title is turned down here (the API returns 400 for the same
 * case), and picking a project name while the title is empty borrows it for
 * the title too: the only time a project name is copied into the title.
 */
export interface IdeaDraftFields {
  title: string;
  setTitle: (title: string) => void;
  notes: string;
  setNotes: (notes: string) => void;
  projectName: string;
  setProjectName: (name: string) => void;
  /** A name suggested by kimi was picked. */
  pickProjectName: (name: string) => void;
  tags: string[];
  setTags: (tags: string[]) => void;
  status: Status;
  setStatus: (status: Status) => void;
  links: Link[];
  setLinkAt: (i: number, patch: Partial<Link>) => void;
  addLink: () => void;
  removeLink: (i: number) => void;
  /** Validates, then hands the cleaned draft to onSubmit. */
  submit: () => void;
  /** What to show under the title: the form's own complaint, else the server's. */
  message: string | undefined;
}

const sameLinks = (a: Link[], b: Link[]) =>
  a.length === b.length && a.every((l, i) => l.url === b[i].url && l.label === b[i].label);
const sameTags = (a: string[], b: string[]) => a.length === b.length && a.every((t, i) => t === b[i]);

export function useIdeaDraft({
  open,
  idea,
  error,
  onSubmit,
  onDirtyChange,
}: {
  open: boolean;
  idea?: DraftSource;
  /** The server's complaint about the last submit. */
  error?: string;
  onSubmit?: (draft: IdeaDraft) => void;
  /** Told whether the open form holds edits that differ from what it opened with. */
  onDirtyChange?: (dirty: boolean) => void;
}): IdeaDraftFields {
  const [title, setTitle] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [projectName, setProjectName] = React.useState('');
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
    setProjectName((idea && idea.project_name) || '');
    setTags((idea && idea.tags) || []);
    setStatus((idea && idea.status) || 'raw');
    setLinks((idea && idea.links) ? idea.links.map((l) => ({ ...l })) : []);
    setLocal(null);
  }, [open, idea]);

  const dirty =
    open &&
    (title !== ((idea && idea.title) || '') ||
      notes !== ((idea && idea.notes) || '') ||
      projectName !== ((idea && idea.project_name) || '') ||
      !sameTags(tags, (idea && idea.tags) || []) ||
      status !== ((idea && idea.status) || 'raw') ||
      !sameLinks(links, (idea && idea.links) || []));
  React.useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  return {
    title,
    setTitle: (value) => {
      setTitle(value);
      setLocal(null);
    },
    notes,
    setNotes,
    projectName,
    setProjectName,
    pickProjectName: (name) => {
      setProjectName(name);
      if (!title.trim()) {
        setTitle(name);
        setLocal(null);
      }
    },
    tags,
    setTags,
    status,
    setStatus,
    links,
    setLinkAt: (i, patch) => setLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l))),
    addLink: () => setLinks((prev) => [...prev, { url: '', label: '' }]),
    removeLink: (i) => setLinks((prev) => prev.filter((_, idx) => idx !== i)),
    submit: () => {
      if (!title.trim()) {
        setLocal('A nugget needs a title.');
        return;
      }
      // Drop blank rows; the server validates the rest and returns 400 on a bad URL.
      const cleaned = links.map((l) => ({ url: l.url.trim(), label: l.label.trim() })).filter((l) => l.url !== '');
      onSubmit?.({ title: title.trim(), notes, tags, status, links: cleaned, project_name: projectName.trim() });
    },
    message: local || error,
  };
}
