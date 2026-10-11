import React from 'react';
import type { TagSuggestion } from '../../api';
import { REASON_DELAY_MS, useSuggestionReason, type ReasonSide } from '../../models/useSuggestionReason';
import { cx, Icon } from './ui';

export interface TagSuggestionsProps {
  suggestions: TagSuggestion[];
  onAdd: (tag: string) => void;
  onDismiss: (tag: string) => void;
  /** The tag whose Add or Dismiss is in flight, if any. */
  busy?: string | null;
}

/** Re-exported for the tests that wait it out. */
export { REASON_DELAY_MS };

/** The thought bubble's widest: this many px, and at most this share of the viewport. */
const REASON_MAX_WIDTH = 300;
const REASON_MAX_VW = 78;

/**
 * A nugget's tag suggestions, pencilled in: one dashed tray at the end of the
 * tag row, labelled SUGGESTED with a pencil, holding a dashed chip per tag.
 * Clicking a chip's name inks the tag in (adds it); its × rubs it out
 * (dismisses it). Why a tag was suggested is a thought bubble on hover or
 * keyboard focus, and the probability is never shown. Same props, labels and
 * timing as Classic's tray (they share `useSuggestionReason`). Renders nothing
 * for a nugget with none.
 */
export function TagSuggestions({ suggestions, onAdd, onDismiss, busy = null }: TagSuggestionsProps) {
  if (suggestions.length === 0) return null;
  return (
    <span role="group" aria-label="Suggested tags" className="comic-suggest-tray">
      <span className="comic-suggest-label">
        <Icon name="pencil" size={14} />
        suggested
      </span>
      {suggestions.map((s) => (
        <SuggestedTag key={s.tag} suggestion={s} onAdd={onAdd} onDismiss={onDismiss} busy={busy === s.tag} />
      ))}
    </span>
  );
}

/**
 * One suggestion's chip. While its add or dismiss is in flight it is
 * aria-disabled rather than disabled, so a focused button keeps focus (and a
 * blur) instead of dropping it silently and leaving the reason stuck open.
 */
function SuggestedTag({
  suggestion: { tag, examples },
  onAdd,
  onDismiss,
  busy,
}: {
  suggestion: TagSuggestion;
  onAdd: (tag: string) => void;
  onDismiss: (tag: string) => void;
  busy: boolean;
}) {
  const reasonId = React.useId();
  const { ref, handlers, hovered, open, side } = useSuggestionReason<HTMLSpanElement>({ maxWidth: REASON_MAX_WIDTH, maxVw: REASON_MAX_VW });

  return (
    <span ref={ref} {...handlers} className={cx('comic-suggest-chip', (hovered || open) && 'comic-suggest-chip--inked', busy && 'comic-suggest-chip--busy')}>
      <button type="button" className="comic-suggest-add" onClick={() => busy || onAdd(tag)} aria-disabled={busy || undefined} aria-label={`Add the suggested tag ${tag}`} aria-describedby={reasonId}>
        <span className="comic-suggest-plus" aria-hidden="true">
          <Icon name="plus" size={11} />
        </span>
        <span className="comic-hash">{tag}</span>
      </button>
      <button type="button" className="comic-suggest-dismiss" onClick={() => busy || onDismiss(tag)} aria-disabled={busy || undefined} aria-label={`Dismiss the suggested tag ${tag}`}>
        ×
      </button>
      <Reason id={reasonId} tag={tag} examples={examples} open={open} side={side} />
    </span>
  );
}

/**
 * Why a tag was suggested, as a thought bubble: the example titles Jev was
 * shown for it. Always in the DOM so the Add button's aria-describedby
 * resolves; hidden (and out of the accessibility tree) until open. A
 * transparent bridge spans the gap under the chip, so the pointer can move onto
 * the bubble without closing it. Motion uses the house duration tokens, which
 * are 0 under prefers-reduced-motion.
 */
function Reason({ id, tag, examples, open, side }: { id: string; tag: string; examples: string[]; open: boolean; side: ReasonSide }) {
  return (
    <span id={id} role="tooltip" data-side={side} data-open={open || undefined} className="comic-thought" style={{ visibility: open ? 'visible' : 'hidden' }}>
      <span className="comic-thought-puff comic-thought-puff--big" aria-hidden="true" />
      <span className="comic-thought-puff comic-thought-puff--small" aria-hidden="true" />
      <span className="comic-thought-body">
        {examples.length > 0 ? (
          <>
            Suggested because it reads like {examples.length === 1 ? 'this nugget' : 'these nuggets'} tagged <b className="comic-hash">{tag}</b>:
            <ul className="comic-thought-list">
              {examples.map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ul>
          </>
        ) : (
          <span className="comic-thought-line">
            Suggested from nuggets already tagged <b className="comic-hash">{tag}</b>
          </span>
        )}
        <span className="comic-thought-foot">click to ink it in · × to rub it out</span>
      </span>
    </span>
  );
}
