# Dialog

A panel that sits on the page like a sticker: `shadow-sticker` behind it, a `title` heading, a round close button, and a `mayo` footer for its pills.

**Provide** `title` (sentence case with a full stop, "Edit nugget."), `onClose`, the body as children (a `CaptionBox` first if the page changed underneath, then `Field`s), and a `footer` with "Cancel" (paper) then the one `tomato` pill ("Save").

It is presentational: the host renders the dimmed overlay (`ink` at 40%), traps focus, closes on Escape and returns focus to what opened it. 560px wide by default; it goes full width with the `page` margin under 700px.
