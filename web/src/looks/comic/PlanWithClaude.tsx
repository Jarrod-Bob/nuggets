import type { Idea } from '../../api';
import { claudeDesktopUrl } from '../../lib/planPrompt';
import { usePlan } from '../../models/usePlan';
import { Button, Dialog, Field } from './ui';

/**
 * "Plan with Claude" in the Comic look: the planning prompt in a speech bubble
 * (it is what you will say to Claude), the ways to send it, then a field to
 * bring Claude's answer back into the notes. Same props, labels and accessible
 * names as Classic's, driven by the same `usePlan` model. The model stays
 * mounted while the dialog is closed, as Classic's does, so an unsaved answer
 * survives a close.
 */
export interface PlanWithClaudeProps {
  open: boolean;
  idea: Idea;
  onClose: () => void;
  /** Appends the answer to the nugget's notes; a rejection's message is shown in the dialog. */
  onSave: (answer: string) => Promise<void>;
}

export function PlanWithClaude({ open, idea, onClose, onSave }: PlanWithClaudeProps) {
  const plan = usePlan({ idea, onSave, onClose });
  const { prompt, deepLink, copyNote, answer, saving, saveError, close } = plan;
  if (!open) return null;

  return (
    <Dialog
      width={680}
      title="Plan with Claude"
      description="A planning prompt built from this nugget. Send it to Claude, then paste the answer back to keep it in the notes."
      onClose={close}
      footer={<Button onClick={close}>Close</Button>}
    >
      <div className="comic-bubble comic-bubble--prompt">
        <pre aria-label="Planning prompt" tabIndex={0} className="comic-plan-prompt">
          {prompt}
        </pre>
      </div>

      <div className="comic-plan-actions">
        <a href={claudeDesktopUrl(deepLink.prompt)} className="comic-pill comic-pill--tomato comic-pill--sm">
          Open in Claude Desktop
        </a>
        <Button size="sm" onClick={plan.copyAndOpenWeb}>
          Copy &amp; open claude.ai
        </Button>
        <Button size="sm" onClick={() => void plan.copy()}>
          Copy prompt
        </Button>
      </div>
      {deepLink.trimmed && (
        <p role="status" className="comic-plan-note comic-plan-note--strong">
          These notes are long, so the Claude Desktop link carries a trimmed copy of them. Copy prompt always copies the complete prompt.
        </p>
      )}
      <p className="comic-plan-note">Claude Desktop opens with the prompt filled in, ready for you to send. No desktop app? Copy &amp; open claude.ai, then paste.</p>
      {copyNote && (
        <p role="status" className="comic-plan-note comic-plan-note--strong">
          {copyNote}
        </p>
      )}

      <div className="comic-plan-answer">
        <Field
          id="plan-answer"
          label="Claude's answer"
          multiline
          rows={6}
          placeholder="Paste Claude's plan here"
          value={answer}
          onChange={(e) => plan.setAnswer(e.target.value)}
          hint="Saving appends it to the end of this nugget's notes; nothing already there is replaced."
        />
        {saveError && (
          <p role="alert" className="comic-plan-error">
            {saveError}
          </p>
        )}
        <div className="comic-plan-save">
          <Button size="sm" onClick={plan.save} disabled={saving || !answer.trim()}>
            Save to notes
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
