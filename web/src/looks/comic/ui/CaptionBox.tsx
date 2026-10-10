import React from 'react';

/** A narration box: a notice about the page, in the strip's caption style. */
export interface CaptionBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `nugget` (default); `mayo` or `paper` on a nugget-gold ground; `error` is paper with a red-ink line (use ActionError). */
  tone?: 'nugget' | 'mayo' | 'paper' | 'error';
  /** The narrator's lead-in, e.g. "Meanwhile, on the tray…". */
  eyebrow?: React.ReactNode;
}

export function CaptionBox({ tone = 'nugget', eyebrow, className, children, ...rest }: CaptionBoxProps) {
  return (
    <div className={['comic-caption', `comic-caption--${tone}`, className].filter(Boolean).join(' ')} {...rest}>
      {eyebrow && <span className="comic-caption-eyebrow">{eyebrow}</span>}
      <div className="comic-caption-text">{children}</div>
    </div>
  );
}
