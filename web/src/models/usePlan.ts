import React from 'react';
import type { Idea } from '../api';
import { buildDeepLinkPrompt, buildPlanPrompt, CLAUDE_WEB_NEW_CHAT_URL } from '../lib/planPrompt';

/**
 * Plan with Claude, shared by every look (issue #16a, ADR 0002): the planning
 * prompt built from the nugget, copying it, and saving Claude's answer back
 * onto the end of the notes.
 */
export interface Plan {
  /** The complete prompt. */
  prompt: string;
  /** The prompt for the Claude Desktop link, trimmed when the notes are long. */
  deepLink: { prompt: string; trimmed: boolean };
  /** What happened to the last copy, once there has been one. */
  copyNote: string | undefined;
  copy: () => Promise<void>;
  /** Copies, then opens a new claude.ai chat to paste into. */
  copyAndOpenWeb: () => void;
  answer: string;
  setAnswer: (answer: string) => void;
  saving: boolean;
  saveError: string | undefined;
  /** Appends the answer to the notes, then closes. */
  save: () => void;
  /** Forgets the copy note and any save error, then closes. */
  close: () => void;
}

export function usePlan({ idea, onSave, onClose }: { idea: Idea; onSave: (answer: string) => Promise<void>; onClose: () => void }): Plan {
  const prompt = React.useMemo(() => buildPlanPrompt(idea), [idea]);
  const deepLink = React.useMemo(() => buildDeepLinkPrompt(idea), [idea]);

  const [copyNote, setCopyNote] = React.useState<string | undefined>(undefined);
  const [answer, setAnswer] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | undefined>(undefined);

  const close = () => {
    setCopyNote(undefined);
    setSaveError(undefined);
    onClose();
  };

  const copy = (): Promise<void> => {
    // Started inside the click, before anything else can take focus.
    const write = navigator.clipboard?.writeText(prompt) ?? Promise.reject(new Error('no clipboard'));
    return write.then(
      () => setCopyNote('Copied the full prompt.'),
      () => setCopyNote("Couldn't copy. Select the prompt above and copy it by hand."),
    );
  };

  return {
    prompt,
    deepLink,
    copyNote,
    copy,
    copyAndOpenWeb: () => {
      void copy().then(() => window.open(CLAUDE_WEB_NEW_CHAT_URL, '_blank', 'noopener'));
    },
    answer,
    setAnswer,
    saving,
    saveError,
    save: () => {
      setSaving(true);
      onSave(answer)
        .then(() => {
          setAnswer('');
          close();
        })
        .catch((err: unknown) => setSaveError(err instanceof Error ? err.message : 'Something went wrong.'))
        .finally(() => setSaving(false));
    },
    close,
  };
}
