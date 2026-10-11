# LookPicker

The Look picker at the top of Settings: Classic and Comic as two tilted sticker tiles in a radio group legended "Look". Each tile is a real radio, named "Classic" or "Comic", with a picture of its look: a plain grey-lined card for Classic, a `NuggetMark` for Comic.

The picked tile fills `nugget`, gains a check and lifts onto `shadow-sticker`; the other sits flat on `shadow-stamp`. Arrow keys move between them, as in any radio group.

**Provide** `value` (`'classic'` or `'comic'`) and `onChange`. Set `comicInProgress` while some screens still fall back to Classic: the Comic tile wears an "In progress" tag, which describes it rather than renaming it. `hint` adds a line under the tiles. The look applies at once; there is no Save.
