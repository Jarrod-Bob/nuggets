import { Button } from './Button';
import { CaptionBox } from './CaptionBox';

/**
 * A failed action in plain words: a red-ink caption box with role="alert".
 * Renders nothing without a message. A "Dismiss" pill shows when `onDismiss` is set.
 */
export function ActionError({ message, onDismiss, className }: { message?: string; onDismiss?: () => void; className?: string }) {
  if (!message) return null;
  return (
    <CaptionBox tone="error" role="alert" className={['comic-error', className].filter(Boolean).join(' ')}>
      <span className="comic-error-text">{message}</span>
      {onDismiss && (
        <Button size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      )}
    </CaptionBox>
  );
}
