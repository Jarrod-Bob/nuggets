# SuggestedTags

Tags suggested for a nugget, pencilled in: a dashed `ink-soft` tray labelled "SUGGESTED" with a pencil, at the end of the nugget's tag row. Each suggestion is a dashed chip with a ⊕ and its `#tag`, then ×.

- **Click the tag** to ink it in (add it). **×** rubs it out (dismisses it). While either is in flight the chip dims and is `aria-disabled`, so focus is not dropped.
- **Hover or focus** a chip: after 250ms it inks up (solid line, `mayo` fill, `nugget` ⊕) and a `ThoughtBubble` floats below it with why: "Suggested because it reads like these nuggets tagged **#animation**:" and the example titles, then "click to ink it in · × to rub it out". It opens leftwards near the right edge, closes the moment both pointer and focus leave, and Escape closes it. The probability is never shown.
- The add button's label is literal ("Add the suggested tag animation") and is described by the bubble.

**Provide** `suggestions` (`{tag, examples}`), `onAdd`, `onDismiss` and `busy` (the tag in flight). It renders nothing when there are none. `openTag` holds one bubble open, for previews only.
