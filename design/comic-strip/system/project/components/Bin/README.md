# Bin

The bin (Trash): binned nuggets, newest binned first, as greyed `BinCard`s under a caption that says what Restore and Purge do. Empty, it is an `EmptyState`: "Meanwhile, in the bin…" / "Trash is empty".

**Provide** `ideas` (`{id, title, tags, archivedAt}`, newest first), `onRestore(id)` and `onPurge(id)`. Each card's shape and tilt come from its id, so a nugget looks the same every visit. Cards sit straight on the page in an auto-filling grid (230px minimum), not on the tray: the bin is not the tray.

The page around it is a `Strip` with "Back to the bank" and Settings, then an `ActionError` if Restore or Purge failed, then the bin.
