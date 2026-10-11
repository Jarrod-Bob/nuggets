# SettingsSection

One integration in the Settings dialog: a `mayo` caption-box heading (the integration's name as an `h3` plus a line on what it does), a status line, a literal error, its `Field`s and its pills. Sections stack in the comic `Dialog` titled "Settings", under the `LookPicker`, divided by an ink line.

**Provide** `title` and `description` (the Classic look's words: "spices", "GitHub", "kimi", "Tag suggestions"), then:
- `status`: a `StatePill`: `ok` "Connected", `off` "Not connected", `attention` "Needs re-sync" or `error` "Error"; and `detail`, mono `ink-soft` facts on the right ("every 60s · synced 2 min ago", "2 queued · 1 failed").
- `error`: the message, shown as an `ActionError` without Dismiss.
- children: the `Field`s and any notes.
- `dangerAction`: "Disconnect" as a small `danger` pill, on the left.
- `actions`: the rest on the right, the commit last: "Change" / "Sync now", "Cancel" / "Save", "Not yet" / "Re-sync", "Connect", "Change key". All paper: with four sections in one dialog, a tomato pill in each would make four primaries.

There is no Test pill: the Classic look has none, and a connection proves itself on Save. kimi has no status pill; it says "Saved." in a status line instead.
