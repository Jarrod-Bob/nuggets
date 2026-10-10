# CaptionBox

A narration box: the strip's yellow caption in the corner of a panel. It talks about the page rather than being part of it.

**Use it for** notices: "Meanwhile, on the tray… 3 new nuggets landed. The tray catches up when you save or cancel." while a dialog is open over a live tray. `tone="mayo"` or `"paper"` when it sits on a nugget-gold strip.

**Provide** an `eyebrow` in the narrator's voice ("Meanwhile, on the tray…", "Previously…") and the plain sentence as children. Give it `role="status"` when it appears in response to something. **Don't** use it for errors; errors are literal text under the field they belong to.
