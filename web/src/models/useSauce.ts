import React from 'react';

/**
 * The curry corner's state, shared by every look (issue #37, ADR 0002): hovering
 * the sauce with a mouse previews the flood, a press pins it, and a second
 * press or Escape drains it. How the sauce and the flood are drawn is the
 * look's business; this only decides whether the flood is showing.
 */
export interface Sauce {
  /** Whether the flood is showing, pinned or previewed. */
  open: boolean;
  pinned: boolean;
  /** A mouse pointer arrived on the sauce. */
  hoverStart: () => void;
  /** The pointer left the sauce. */
  hoverEnd: () => void;
  /** A click, tap or Enter on the sauce: pins it, or drains a pinned one. */
  press: () => void;
  /** Escape while the sauce has focus. Returns whether it drained anything, so the caller knows to stop the key there. */
  escape: () => boolean;
}

export function useSauce(): Sauce {
  const [pinned, setPinned] = React.useState(false);
  const [previewing, setPreviewing] = React.useState(false);
  // After a press drains the flood, the pointer is still on the sauce; don't let it preview again until it leaves.
  const holdPreview = React.useRef(false);
  const open = pinned || previewing;

  return {
    open,
    pinned,
    hoverStart: () => {
      if (!holdPreview.current) setPreviewing(true);
    },
    hoverEnd: () => {
      holdPreview.current = false;
      setPreviewing(false);
    },
    press: () => {
      // Unpinning drains straight away, even with the pointer still on the sauce.
      if (pinned) {
        holdPreview.current = true;
        setPreviewing(false);
      }
      setPinned(!pinned);
    },
    escape: () => {
      if (!open) return false;
      setPinned(false);
      setPreviewing(false);
      return true;
    },
  };
}
