# CaptionBox

A narration box: the strip's yellow caption in the corner of a panel. It talks about the page rather than being part of it.

**Use it for** notices: "Meanwhile, on the tray… 3 new nuggets landed. The tray catches up when you save or cancel." while a dialog is open over a live tray. `tone="mayo"` or `"paper"` when it sits on a nugget-gold strip.

**Provide** an `eyebrow` in the narrator's voice ("Meanwhile, on the tray…", "Previously…") and the plain sentence as children. Give it `role="status"` when it appears in response to something.

`tone="error"` is paper with a red-ink (`tomato`) line, for a failed action; use it through `ActionError`, which says the error in plain words with no eyebrow. A field's own error stays literal text under that field. `EmptyState` is a caption box too.
