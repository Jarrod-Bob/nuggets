import React from 'react';
import type { TagSuggestion } from '../../api';

export interface TagSuggestionsProps {
  suggestions: TagSuggestion[];
  onAdd: (tag: string) => void;
  onDismiss: (tag: string) => void;
  /** The tag whose Add or Dismiss is in flight, if any. */
  busy?: string | null;
}

/** How long a pointer or focus rests on a suggestion before its reason shows. */
export const REASON_DELAY_MS = 250;
/** The reason popover's widest, as in its maxWidth below. */
const REASON_MAX_WIDTH = 300;
/** Keep the popover this far from the page's right edge, or open it leftwards. */
const EDGE_GUTTER = 16;

/**
 * A nugget's tag suggestions (Jev tag-suggestions design §7): one dashed tray
 * at the end of the tag row, labelled "suggested", holding a compact chip per
 * tag. Clicking a chip's name adds the tag; its × dismisses it. Why a tag was
 * suggested shows only on hover or keyboard focus. The probability is never
 * shown. Renders nothing for a nugget with none.
 */
export function TagSuggestions({ suggestions, onAdd, onDismiss, busy = null }: TagSuggestionsProps) {
  if (suggestions.length === 0) return null;
  return (
    <span
      role="group"
      aria-label="Suggested tags"
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        padding: '3px 4px 3px 10px',
        borderRadius: 'var(--radius-pill)',
        background: 'var(--nug-cream-200)',
        border: 'var(--border-regular) dashed var(--nug-golden-500)',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-micro)',
          color: 'var(--nug-golden-700)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 9,
            height: 9,
            borderRadius: 'var(--radius-nugget)',
            background: 'var(--nug-golden-400)',
            boxShadow: '0 0 0 3px var(--nug-golden-100)',
          }}
        />
        suggested
      </span>
      {suggestions.map((s) => (
        <SuggestedTag key={s.tag} suggestion={s} onAdd={onAdd} onDismiss={onDismiss} busy={busy === s.tag} />
      ))}
    </span>
  );
}

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
  const chip = React.useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [side, setSide] = React.useState<'right' | 'left'>('right');

  // Hover or focus arms the reason; it shows after REASON_DELAY_MS and goes
  // the moment both have left. Escape closes it until the next arrival.
  const engaged = hovered || focused;
  React.useEffect(() => {
    if (!engaged) {
      setOpen(false);
      return;
    }
    const timer = setTimeout(() => {
      // Open leftwards when the popover would run off the right edge.
      const left = chip.current?.getBoundingClientRect().left ?? 0;
      const width = Math.min(REASON_MAX_WIDTH, window.innerWidth * 0.78);
      setSide(left + width > document.documentElement.clientWidth - EDGE_GUTTER ? 'left' : 'right');
      setOpen(true);
    }, REASON_DELAY_MS);
    return () => clearTimeout(timer);
  }, [engaged]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const button: React.CSSProperties = {
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    cursor: busy ? 'default' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 'var(--radius-pill)',
  };

  return (
    <span
      ref={chip}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        height: 24,
        borderRadius: 'var(--radius-pill)',
        background: hovered ? 'var(--nug-golden-50)' : 'var(--nug-white)',
        border: `var(--border-regular) solid ${hovered ? 'var(--nug-golden-500)' : 'var(--nug-golden-300)'}`,
        color: 'var(--nug-ink-700)',
        fontSize: 'var(--text-body-sm)',
        fontWeight: 'var(--weight-semibold)',
        whiteSpace: 'nowrap',
        opacity: busy ? 0.6 : 1,
        transition: 'background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)',
      }}
    >
      <button
        type="button"
        onClick={() => onAdd(tag)}
        disabled={busy}
        aria-label={`Add the suggested tag ${tag}`}
        aria-describedby={reasonId}
        style={{ ...button, gap: 5, height: '100%', padding: '0 3px 0 6px', fontWeight: 'var(--weight-bold)' }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 15,
            height: 15,
            flex: 'none',
            borderRadius: 'var(--radius-nugget)',
            background: 'var(--nug-golden-100)',
            color: 'var(--nug-golden-700)',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        {tag}
      </button>
      <button
        type="button"
        onClick={() => onDismiss(tag)}
        disabled={busy}
        aria-label={`Dismiss the suggested tag ${tag}`}
        style={{ ...button, justifyContent: 'center', width: 22, height: 22, marginRight: 1, fontSize: 15, lineHeight: 1 }}
      >
        ×
      </button>
      <Reason id={reasonId} tag={tag} examples={examples} open={open} side={side} />
    </span>
  );
}

/**
 * Why a tag was suggested: the example titles Jev was shown for it. Always in
 * the DOM so the Add button's aria-describedby resolves; hidden (and out of
 * the accessibility tree) until open. A transparent bridge spans the gap under
 * the chip, so the pointer can move onto the popover without closing it. The
 * motion uses the duration tokens, which are 0 under prefers-reduced-motion.
 */
function Reason({ id, tag, examples, open, side }: { id: string; tag: string; examples: string[]; open: boolean; side: 'right' | 'left' }) {
  const anchor: React.CSSProperties = side === 'left' ? { right: 0 } : { left: 0 };
  return (
    <span
      id={id}
      role="tooltip"
      data-side={side}
      style={{
        position: 'absolute',
        top: '100%',
        ...anchor,
        zIndex: 5,
        paddingTop: 10,
        visibility: open ? 'visible' : 'hidden',
        opacity: open ? 1 : 0,
        transform: open ? 'none' : 'translateY(-4px)',
        transition:
          'opacity var(--dur-fast) var(--ease-out), transform var(--dur-base) var(--ease-bounce), visibility var(--dur-fast)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 4,
          ...(side === 'left' ? { right: 18 } : { left: 18 }),
          width: 12,
          height: 12,
          background: 'var(--surface-inverse)',
          transform: 'rotate(45deg)',
          borderRadius: 2,
        }}
      />
      <span
        style={{
          display: 'block',
          width: 'max-content',
          maxWidth: `min(${REASON_MAX_WIDTH}px, 78vw)`,
          whiteSpace: 'normal',
          background: 'var(--surface-inverse)',
          color: 'var(--nug-cream-50)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 12px',
          boxShadow: 'var(--shadow-3)',
          fontSize: 'var(--text-body-sm)',
          fontWeight: 'var(--weight-medium)',
          lineHeight: 1.4,
          textAlign: 'left',
        }}
      >
        {examples.length > 0 ? (
          <>
            Suggested because it reads like {examples.length === 1 ? 'this nugget' : 'these nuggets'} tagged <TagName tag={tag} />:
            <ul className="nug-reason" style={{ margin: '6px 0 8px', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {examples.map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ul>
          </>
        ) : (
          <span style={{ display: 'block', marginBottom: 6 }}>
            Suggested from nuggets already tagged <TagName tag={tag} />
          </span>
        )}
        <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--nug-ink-300)' }}>
          click to add · × to dismiss
        </span>
      </span>
    </span>
  );
}

function TagName({ tag }: { tag: string }) {
  return <b style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-bold)', color: 'var(--nug-golden-300)' }}>{tag}</b>;
}
