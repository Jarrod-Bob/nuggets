# Two looks, split at the view, until one wins

The web app is being drawn in a second look, the Comic look (#46, design in `design/comic-strip/`), alongside the Classic look, so the captain can live with both and pick one. Both looks share every route, behaviour and piece of logic: pages are thin containers over hooks (`useBank`, `useNuggetPage`, …), and each look supplies its own views (`BankView`, `NuggetView`, …) behind the same props. The look is a `settings` row owned by `internal/look`, stamped onto `<html data-look>` by the server so the first paint is right, with a per-tab `?look=` override that is never saved. This is temporary: once a look wins, the other one's views and tokens are deleted, and if Classic wins the `look` setting goes too.

## Considered Options

- **Token-only re-theming.** Cheapest, but the Comic look changes shapes and layout (ink-lined blob cards, stickers, panels), not just colours, so tokens can't reach it.
- **A long-lived branch for the Comic look.** No dual code on `main`, but it goes stale within days and makes side-by-side comparison impossible.
- **Swapping small components inside shared pages.** Less duplication, but the Comic tray's layout differs too much from Classic's for shared page markup to hold both.

## Consequences

- Both looks must use the same accessible names, because the page behaviour tests run once per look.
- A view not yet drawn in the Comic look falls back to Classic, so the picker can offer "Comic (in progress)" from the first PR.
- Comic fonts and tokens load only in the Comic look's lazy chunk; Classic users never download them. Comic tokens live under `[data-look="comic"]` and must not reuse the `--nug-*` names.
- The comic curry corner sits top-right and Classic's top-left; that is a look difference, not a behaviour one.
- Every UI change made while both looks exist needs doing twice. That cost is why the comparison has an end: the final ticket under #46 deletes the losing look.
