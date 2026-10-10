# Pill

The only button shape: a 3px ink pill in `button` type.

**Variants:** `paper` (default) for everything; `tomato` for the one primary action on a screen ("Drop a nugget", "Drop it in"); `ink` for a pressed or selected state; `danger` for an action that cannot be undone ("Purge", "Disconnect"): paper, ink text, outlined in red ink (`tomato`), never filled. `size="lg"` (58px tall, 20px label) for the single call to action on a page, such as "Tip the bucket"; `size="sm"` (34px, 14px label) for pills inside a card, a caption box or a settings section.

Pass `href` and the pill renders as a link, for a deep link that must be a real `href` ("Open in Claude Desktop").

**Provide** a sentence-case verb phrase as children, and optionally `icon` / `iconAfter` (`arrow-right` after "Tip the bucket", `arrow-left` before "Back to the tray", `plus` before "Drop a nugget").

Hover lifts 2px up-left onto `shadow-lift`; press drops 1px and loses the shadow. **Don't** put sound-effect lettering on a pill, and don't put two tomato pills side by side.
