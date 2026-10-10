# Panel

An inked comic panel: the block every page is built from.

**Use it for** every region of a page. Separate panels with the `gutter` (14px) and nothing else; never nest a panel inside a panel except the tray's liner.

**Provide** the content as children, and a `tone`:
- `paper` (default) for reading panels.
- `mayo` for the one feature panel on a screen (the bucket, a nugget's hero). One per screen.
- `nugget` only for the top `Strip`; prefer `Strip` itself.
- `tomato` for the action panel that holds the page's primary pills. Text inside is `on-tomato` (ink).

Set `padded={false}` for illustration panels that bleed to the line. Pass `as` for semantics (`section`, `aside`).

**Don't** add shadows, change the 3px `line`, or round the corners beyond `radius-panel`.
