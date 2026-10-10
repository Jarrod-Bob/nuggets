import React from 'react';

/** How long a pointer or focus rests on a suggestion before its reason shows. */
export const REASON_DELAY_MS = 250;
/** Keep the popover this far from the page's right edge, or open it leftwards. */
const EDGE_GUTTER = 16;

/** Which way the reason popover opens from its chip. */
export type ReasonSide = 'right' | 'left';

/**
 * When a tag suggestion's reason shows, shared by every look (Jev tag-suggestions
 * design §7, ADR 0002): hover or focus arms it, it shows after REASON_DELAY_MS,
 * and it goes the moment both have left. Escape closes it until the next
 * arrival. It opens leftwards when it would run off the right edge, so it
 * needs to know how wide the look draws the popover.
 */
export interface SuggestionReason<T extends HTMLElement> {
  /** Goes on the chip: the reason's side is measured from it. */
  ref: React.RefObject<T | null>;
  hovered: boolean;
  open: boolean;
  side: ReasonSide;
  /** Spread onto the chip. */
  handlers: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocus: () => void;
    onBlur: (e: React.FocusEvent<T>) => void;
  };
}

export function useSuggestionReason<T extends HTMLElement>({
  maxWidth,
  maxVw,
}: {
  /** The popover's widest, in px. */
  maxWidth: number;
  /** ...and at most this share of the viewport, in vw. */
  maxVw: number;
}): SuggestionReason<T> {
  const ref = React.useRef<T>(null);
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [side, setSide] = React.useState<ReasonSide>('right');

  const engaged = hovered || focused;
  React.useEffect(() => {
    if (!engaged) {
      setOpen(false);
      return;
    }
    const timer = setTimeout(() => {
      const left = ref.current?.getBoundingClientRect().left ?? 0;
      const width = Math.min(maxWidth, (window.innerWidth * maxVw) / 100);
      setSide(left + width > document.documentElement.clientWidth - EDGE_GUTTER ? 'left' : 'right');
      setOpen(true);
    }, REASON_DELAY_MS);
    return () => clearTimeout(timer);
  }, [engaged, maxWidth, maxVw]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return {
    ref,
    hovered,
    open,
    side,
    handlers: {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      onFocus: () => setFocused(true),
      onBlur: (e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      },
    },
  };
}
