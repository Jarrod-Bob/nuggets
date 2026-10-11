import React from 'react';
import type { Idea } from '../../api';
import { Button } from '../core/Button';
import { Dialog } from '../feedback/Dialog';
import { Textarea } from '../forms/Textarea';
import { claudeDesktopUrl } from '../../lib/planPrompt';
import { usePlan } from '../../models/usePlan';

/**
 * "Plan with Claude" (issue #16a, phase 1): shows the planning prompt built
 * from this nugget, sends it to Claude by deep link or clipboard, and takes
 * Claude's answer back into the nugget's notes. nuggets itself calls no LLM.
 */
export interface PlanWithClaudeProps {
  open: boolean;
  idea: Idea;
  onClose: () => void;
  /** Appends the answer to the nugget's notes; a rejection's message is shown in the dialog. */
  onSave: (answer: string) => Promise<void>;
}

const note: React.CSSProperties = { margin: '8px 0 0', fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-500)', textWrap: 'pretty' };

/** A link dressed as a small secondary Button: the deep link must be a real href. */
const linkButton: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 14px',
  fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-body-sm)',
  color: 'var(--nug-ink-900)', background: 'var(--nug-golden-400)', textDecoration: 'none',
  border: 'var(--border-regular) solid transparent', borderRadius: 'var(--radius-pill)',
  boxShadow: '0 3px 0 var(--nug-golden-600)', whiteSpace: 'nowrap',
};

export function PlanWithClaude({ open, idea, onClose, onSave }: PlanWithClaudeProps) {
  const plan = usePlan({ idea, onSave, onClose });
  const { prompt, deepLink, copyNote, answer, saving, saveError, close } = plan;

  return (
    <Dialog
      open={open}
      width={640}
      title="Plan with Claude"
      description="A planning prompt built from this nugget. Send it to Claude, then paste the answer back to keep it in the notes."
      onClose={close}
      footer={
        <Button variant="ghost" onClick={close}>
          Close
        </Button>
      }
    >
      <pre
        aria-label="Planning prompt"
        tabIndex={0}
        style={{
          margin: 0, maxHeight: 200, overflow: 'auto', padding: '12px 14px',
          fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', lineHeight: 'var(--leading-normal)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--nug-ink-700)',
          background: 'var(--nug-cream-50)', border: 'var(--border-regular) solid var(--nug-ink-200)', borderRadius: 'var(--radius-md)',
        }}
      >
        {prompt}
      </pre>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
        <a href={claudeDesktopUrl(deepLink.prompt)} style={linkButton}>
          Open in Claude Desktop
        </a>
        <Button variant="secondary" size="sm" onClick={plan.copyAndOpenWeb}>
          Copy &amp; open claude.ai
        </Button>
        <Button variant="secondary" size="sm" onClick={() => void plan.copy()}>
          Copy prompt
        </Button>
      </div>
      {deepLink.trimmed && (
        <p role="status" style={{ ...note, color: 'var(--nug-ink-700)' }}>
          These notes are long, so the Claude Desktop link carries a trimmed copy of them. Copy prompt always copies the complete prompt.
        </p>
      )}
      <p style={note}>
        Claude Desktop opens with the prompt filled in, ready for you to send. No desktop app? Copy &amp; open claude.ai, then paste.
      </p>
      {copyNote && (
        <p role="status" style={{ ...note, color: 'var(--nug-ink-700)' }}>
          {copyNote}
        </p>
      )}

      <div style={{ marginTop: 20 }}>
        <Textarea
          id="plan-answer"
          label="Claude's answer"
          rows={6}
          placeholder="Paste Claude's plan here"
          value={answer}
          onChange={(e) => plan.setAnswer(e.target.value)}
          hint="Saving appends it to the end of this nugget's notes; nothing already there is replaced."
        />
        {saveError && (
          <p role="alert" style={{ ...note, color: 'var(--nug-ketchup-600)' }}>
            {saveError}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <Button size="sm" onClick={plan.save} disabled={saving || !answer.trim()}>
            Save to notes
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
