# NameSuggestions

The project-name generator in the Edit nugget dialog: the "Suggested project name" field, a dice pill that asks kimi-no-name-wa for five names from the notes, the names as tilted stickers, and a two-line box saying why the pointed-at name was suggested.

**States** (`state`, plus `available` and `notesEmpty`):
- **Idle, no names yet:** the pill reads "Roll names". Disabled with a literal hint when the notes are empty ("Write some notes and kimi will name it") or kimi is down ("kimi is not available at the moment").
- **Rolling:** the dice spins and the pill reads "Stop"; pressing it cancels the request and keeps whatever names were showing.
- **Names:** five `nugget` stickers with `shadow-stamp`, each tilted a little differently, in a listbox. Pointing at or focusing one shows its explanation in the box below, which is always two lines tall so nothing shifts. Picking one fills the field; the picked sticker turns `curry` with a check, the same sauce that will mark the nugget on the tray. The pill now reads "Re-roll" and asks for five names kimi has not shown this session.
- **Failed:** the names stay and a status line says kimi is not available.

**Provide** `names` (`{name, explanation}`), `value`, `onChange`, `onPick`, `onRoll` and `onCancel`. The field is plain text: kimi only suggests. **No sparkle emoji**; the dice is the generator's mark.
