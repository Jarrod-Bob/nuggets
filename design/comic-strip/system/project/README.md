nuggets is a single-user, local-first idea bank. Ideas are **nuggets**; they live in a **bucket**; tipping the bucket spills them onto a **tray** where you pick one to work on. This system draws that app as a Sunday-paper comic strip: inked panels, one fried-gold fill, tomato stripes, halftone shading and sound-effect lettering for the moments that deserve one.

Build every screen out of panels. If something is not inside a panel, it is in the gutter, and the gutter is empty.

## Content fundamentals

**Voice: the narrator of your own comic.** Plain, dry, a little wry. Panel captions talk like a strip's narration boxes ("Previously, in your notes app…"); everything else is direct instructions in the second person.

- **Use the app's own nouns and verbs.** A nugget, not an idea or an item. The bucket (the home page), the tray (the list), drop (create), tip (spill the bucket), pick one at random, bin (archive). "Drop a nugget", "Tip the bucket", "Back to the tray".
- **Sentence case** for buttons, headings and labels: "Pick one at random", never "Pick One At Random". The wordmark is always `nuggets.`, lowercase, with its full stop.
- **Captions and statuses are uppercase mono** (`label`): "THE BANK · 6 OF 20 ON THE TRAY", "BUILDING", "NUGGET #14". Tags are lowercase mono with a hash: `#saas`.
- **Sound effects mark an event, one at a time.** TIP! when the bucket tips, PLOP! when a nugget lands, CRUNCH! on a nugget's own page. Never more than one on screen, never on a button, never for an error.
- **Errors are literal.** Say what is missing and nothing else: "A nugget needs a title." No apology, no pun, no sound effect.
- **Empty states keep the joke small.** "Nothing on the tray matches. Try another word."
- **Numbers are digits:** "6 of 20", "2d", "5d", "today".
- **No emoji.** The illustrations carry the personality.

## Visual foundations

### Colour
- `paper` is the page and the default panel. `mayo` marks the one feature panel per screen (the bucket, a nugget's hero). `nugget` is the single fill colour: nuggets themselves and the top strip.
- `ink` draws every line and sets all primary text. `ink-soft` is for captions and dates on `paper` or `mayo` only.
- `tomato` is the second voice: bucket stripes, the action panel, the primary pill and sound-effect lettering. Text on it is `on-tomato` (ink); white on tomato does not pass contrast.
- Status has its own fills: `raw` for raw, `nugget` for exploring and building, `mayo` with a dashed line for parked, `burnt` with `on-burnt` text for killed, `pickle` for done. Every status also carries its word in a `StatusPill`, so colour is never the only signal.
- `curry` is the sauce, and it means one thing: **this nugget has a project name.** It marks the dab on a named card, the flood that reveals the name, and the picked name sticker in the generator. Text on it is `on-curry` (white, 4.8:1), so keep that text 15px+ bold or 18px+. `curry-gloss` is its highlight, decoration only.
- `toast` and `nugget-deep` are decoration only (halftone, floor shadows, crumbs). Never text.
- There is one theme, Newsprint. A comic is printed on white; there is no dark edition yet.

### Type
- **Bricolage Grotesque 800** for display, tracked tight (`display-xl`, `display-l`, `title`, `wordmark`, `button`). Headlines wrap with `text-wrap: balance`.
- **Instrument Sans** for reading (`lead`, `body`, `body-strong`).
- **Space Mono** for captions and data (`label`, uppercase, 0.08em; `tag`, bold lowercase).
- **Bangers** for sound effects only (`sfx-xl`, `sfx`, `sfx-s`). Sound effects get an ink outline (`-webkit-text-stroke` 2–4px `ink` with `paint-order: stroke fill`) and, at `sfx-xl`, a 6px solid `ink` text shadow.
- All four are Google Fonts; load them with `<link href="https://fonts.googleapis.com/css2?family=Bangers&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Instrument+Sans:wght@400;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">`.

### Layout
- A page is a grid of `Panel`s separated by the `gutter` (14px) inside `page` padding (24px). The first panel is always the `Strip`: wordmark, then the page's controls.
- Panels split by importance, not symmetry: the bucket page is a 500px column of text panels beside one big illustration panel; a nugget's page is a tall hero panel beside a title panel and a notes panel, with a full-width `tomato` action panel below.
- The tray is a panel inside a gingham border (`assets/Illustrations/gingham.svg`, or two 50% `tomato` linear gradients at a 40px pitch), with a `paper` liner panel inside it. Nugget cards sit on the liner in a 3-column grid that drops to 2 under 1100px and 1 under 700px.
- Below 1100px the panel grids stack to one column. Nothing scrolls sideways.

### Lines, shadows and corners
- **Lines carry the design.** `line` (3px `ink`) on panels, strips, pills and fields; `line-thin` (2.5px) on chips and status pills.
- **Shadows are solid ink offsets, never blurred.** A nugget's shadow is its own outline repeated in `ink` 7px right and 8px down. A hovered pill gets `shadow-lift`; a dialog gets `shadow-sticker`. Nothing else casts a shadow.
- **Shading is halftone:** `ink` dots at about 30% opacity that grow toward the shaded edge, as on the bucket.
- Corners: `radius-panel` on panels, `radius-pill` on anything you press, `radius-field` on inputs.

### Motion
- House easing is a bounce: `cubic-bezier(.34,1.56,.64,1)`.
- Hover: pills move 2px up-left and show `shadow-lift` (140ms). Cards lift 6px, scale to 1.03 and flip their tilt (200ms).
- The one orchestrated moment is the tip: the bucket rotates −34° (420ms), TIP! pops, each card flies from the bucket mouth to its place on the tray (760ms, 55ms stagger). A new nugget drops in from above and lands with PLOP!.
- **Curry is slow on purpose**, like something thick: the pour is a 2s ease-in-out `clip-path` circle from the dab, the drips drop 1.5s in with a 500ms bounce, and the drain is 800ms. Everything else in the system is quick.
- Thought bubbles wait 250ms on hover or focus before they appear, then pop in with the bounce (200ms).
- Under `prefers-reduced-motion`, cut every transition and go straight to the end state. Curry fades in and out (200ms) instead of pouring.

### Interaction states
- **Hover:** lift with `shadow-lift`; never fade.
- **Pressed:** move 1px down-right, drop the shadow.
- **Focus:** a 3px `focus` (ink) outline with 3px offset, a second inked line around the control.
- **Selected chip:** fills `ink` with `paper` text.
- **Suggested (pencilled in):** a dashed `ink-soft` line on `paper`. Hover or focus inks it up: a solid `ink` line on `mayo`. Accepting a suggestion is "inking it in"; dismissing it is "rubbing it out".
- **Picked sticker:** fills `curry` with a check.

## Suggestions from the models

Two features suggest things the user didn't write: **kimi-no-name-wa** names a nugget from its notes, and **Jev** suggests tags. The system draws both as the same idea, a draft the user hasn't committed to yet:

- **Suggestions are pencilled, not inked.** Suggested tags are dashed `ink-soft` chips in a dashed tray labelled SUGGESTED with a pencil (`SuggestedTags`). Nothing a model suggests is solid until the user picks it.
- **Reasons are thoughts, not speech.** Why something was suggested shows in a `ThoughtBubble` on hover or focus, never inline and never as a probability. Speech bubbles stay for the nugget's own notes.
- **Names are stickers.** kimi's five names are tilted `nugget` stickers you peel off and stick on (`NameSuggestions`). The dice re-rolls them; there is no sparkle emoji. The picked one turns `curry`, and from then on the nugget wears a curry dab on the tray (`NuggetCard` `projectName`).
- **Say what happened, literally,** when a model is unavailable: "kimi is not available at the moment", "Write some notes and kimi will name it".
- While a dialog is open over a tray that changes underneath it, say so in a `CaptionBox`: "Meanwhile, on the tray… 3 new nuggets landed. The tray catches up when you save or cancel."

## Iconography
- Icons are inline SVG line drawings: 24px grid, 3px stroke in `currentColor`, round caps and joins, at 18–20px. The set in use: search, arrow-right, arrow-left, plus, close, check, pencil (suggestions) and dice (the name generator). Draw new ones the same way.
- Icons always sit beside a text label.
- The nugget silhouette (`NuggetMark`) is the system's motif and does the work a logo would. It is generated, so every nugget is lumpy in its own way; pass a seed to keep one stable.
- No emoji, no icon font.

## Assets
- `assets/Curry/` holds the curry-dip study art: a base card and the dab at rest, spreading and settled. They are reference for the `NuggetCard` curry corner, which draws itself.
- `assets/Illustrations/` holds the bucket, the hero nugget, the Fig. 1 nugget, the sunburst and the gingham as SVG files with colours baked in (they are the Newsprint palette). Use them as `<img>`.
- There is no logo. The identity is the `nuggets.` wordmark set in `wordmark`, plus the nugget motif.
