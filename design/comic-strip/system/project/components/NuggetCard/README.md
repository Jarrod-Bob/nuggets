# NuggetCard

A nugget on the tray: a lumpy outline in its status fill, with an ink shadow, a shine and crumbs, holding status, age, title and tags.

**Provide** `title`, `status`, `age` ("2d", "today"), `tags` (names without the hash) and an `onClick` that opens the nugget. Give each nugget a stable `shape` (0–7) and `tilt` (about −4° to 4°), derived from its id, so it looks the same on every visit.

Lay cards in a grid with `card-gap` columns: three across, two under 1100px, one under 700px. Keep titles under about 50 characters; they balance onto three lines at most. On hover a card lifts and flips its tilt. **Don't** put a card anywhere but the tray liner, and don't add a second shadow.

## The curry corner

Pass `projectName` and the nugget wears a dab of `curry` on its top-right corner, with two short drips down the face. One dab means named; a nugget without a project name has no sauce at all.

- **Mouse hover on the dab** previews: the sauce pours from the corner across the whole card (a `clip-path` circle, 2s ease-in-out, slow like something thick), then the drips run off the bottom edge and hang (500ms bounce, 1.5s in). The name appears in white `on-curry` display type over a `PROJECT NAME` caption and the title.
- **Click, tap or Enter on the dab** pins it; a second press or Escape drains it (800ms). Clicks anywhere else on the card, the sauce included, still open the nugget.
- **Screen readers** get the name from the dab's label ("Project name: Golden Hour") whether or not the sauce is showing; the flood's text is hidden from them. The dab reports its pinned state with `aria-pressed`.
- **Reduced motion:** no pour; the sauce fades in and out (200ms) and the drips are simply there.
- **Long names** drop from 44px to 32px past 14 characters, then wrap to two lines, then end in an ellipsis.

The dab takes the top-right corner, where an unnamed card shows its age, so a named card moves its age next to its status (`BUILDING · 2D`) and narrows its text to clear the drips. `sauceOpen` starts it pinned (for previews and screenshots).
