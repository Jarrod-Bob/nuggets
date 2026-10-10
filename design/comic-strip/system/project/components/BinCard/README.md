# BinCard

A binned nugget: its card greyed out and tipped further over than on the tray, with "Restore" and "Purge" under it. A binned card doesn't open and doesn't lift on hover.

**Provide** `title`, `tags`, `archivedAt` (when it was binned, "2d ago"), `shape`, `tilt` (about ±5° to ±8°, more than a tray card) and `onRestore` / `onPurge`. It renders an `li`; `Bin` lays them out in a list.

"Restore" is a small paper pill; "Purge" is a small `danger` pill, outlined in red ink, not filled. Purge always asks first: a `Dialog` titled "Purge this nugget?" saying "It's gone for good — restoring won't be an option.", with "Keep it" and a `danger` "Purge".
