# Nuggets Design System

**nuggets** is a single-user **idea bank**. Ideas arrive away from a desk and get typed into Telegram as self-messages, where they survive but become unfindable — which, as the repo's README puts it, amounts to losing them. nuggets gives them somewhere to live: enough structure to retrieve one on purpose, plus a button that surfaces one at random as a mini-challenge.

It is a personal project, deliberately small: **one Go binary that serves a JSON API and an embedded React frontend, opens the browser at `127.0.0.1:7777`, and stores everything in one SQLite file.** Desktop only, single user, no accounts, zero recurring cost. The design system reflects that — it is sized for one screen and two dialogs, not for a product suite.

The brand leans into its own name: warm, golden, snack-bar friendly. The nugget motif is decoration with a job — it makes a utilitarian local-first tool feel like something you'd open for fun.

---

## Sources

| Source | Read |
| --- | --- |
| [github.com/Jarrod-Bob/nuggets](https://github.com/Jarrod-Bob/nuggets) | `README.md` and `docs/superpowers/specs/2026-08-29-nuggets-design.md` (the full MVP design: scope, data model, API, frontend structure, stack rationale). |

**Status: designed, not built.** The repo contains no application code — no components, no CSS, no assets. Everything visual in this system is therefore *authored*, and the spec is the source of truth for **structure, naming, scope and behaviour** only. If you are working on this product, read [the design spec](https://github.com/Jarrod-Bob/nuggets/blob/main/docs/superpowers/specs/2026-08-29-nuggets-design.md) directly — it is dense and worth it — and reconcile anything here that has drifted once real code exists.

### What the spec constrains

- **One screen plus two dialogs.** `IdeaList`, `TagFilter`, `TagCombobox`, `IdeaForm`, `RandomNugget`, `TrashView`. That's the whole frontend.
- **Tags, not folders.** Freeform, autocompleting from tags already in use, normalised server-side to trimmed lowercase so `#SaaS` and `#saas` never diverge. There is no tag management screen.
- **Archive, not delete.** `archived_at` is a nullable timestamp. Restore and purge are separate routes so no ordinary edit can destroy an idea.
- **Random draw is stateless.** `ORDER BY RANDOM() LIMIT 1`, archived excluded, reroll freely, nothing recorded.
- **No toast system and no error boundaries** — errors render inline in the affected component.
- **Mobile and responsive layouts are out of scope for the MVP**, as are status, rating, sort controls, accounts, export, attachments and markdown rendering.

### Known substitutions (please replace)

- **Typefaces.** No brand fonts exist. Display is **Baloo 2**, body **Figtree**, mono **DM Mono**, loaded from the Google Fonts CDN in `tokens/fonts.css`. Because they are CDN-loaded there are no `@font-face` rules or font binaries in this project.
- **Logo.** nuggets has no logo, and nothing here invents one. Identity is the **wordmark** — `nuggets`, lowercase, Baloo 2 ExtraBold, −0.03em tracking — plus a **nugget motif** (generic flat-vector fried-nugget shapes in `assets/`). The motif is explicitly not a mark.
- **Icons.** [Lucide](https://lucide.dev) 0.462.0 from CDN at 2.2px stroke. No icon set was specified; Lucide's rounded caps sit closest to Baloo 2's geometry.
- **Styling implementation.** The real app will use **Tailwind v4 + `@theme` OKLCH variables** with **shadcn's Dialog and Command/Popover only** (spec §4.1). This system ships plain CSS custom properties, so port `tokens/` into a Tailwind `@theme` block rather than importing `styles.css` alongside it — reconciling two token systems is exactly the cost §4.1 warns about.

---

## Content fundamentals

**Voice: the author talking to himself, six months later.** Dry, specific, a little self-deprecating. The repo's own prose sets the register — "The idea isn't lost exactly — it's just never found again, which comes to the same thing." Match that: plain words, one wry turn per paragraph at most, no marketing energy.

- **Second person, active voice, sentence case.** "Drop a nugget", "The bank", "Draw a nugget". Buttons are sentence case — never `DROP A NUGGET`, never `Drop A Nugget`.
- **The wordmark is always lowercase**: `nuggets`. Not "Nuggets", not "NUGGETS".
- **Use the product's own nouns and verbs.** An idea is a **nugget**. The list is **the bank**. Saving is **dropping** ("Drop it in"). Archiving is **binning**. They are the joke and the information architecture at once.
- **Food puns: one per screen maximum, and only where they cost nothing.** Empty states and the draw dialog can be playful. Field labels, errors and anything destructive are literal: "Purge this nugget? It's gone for good — restoring won't be an option."
- **Errors state what happened, then what to do, without apology.** "A nugget needs a title." Not "Oops! Something went wrong."
- **No toasts, so no confirmation copy.** The list updating *is* the confirmation. This is a spec constraint, not a style choice.
- **Numerals always, set in mono** when countable: "6 of 7 nuggets", "2d ago", "binned 3d ago".
- **No emoji.** The illustrations carry the personality; emoji would double up. User-authored content is never touched.
- **Tags are shown lowercase, always**, because that is what the server stores. The combobox previews the normalisation ("Saved as `saas`") so the rule is never a surprise.

**Microcopy set**

| Slot | Copy |
| --- | --- |
| Primary CTA | `Drop a nugget` |
| Form submit | `Drop it in` (create) · `Save` (edit) |
| Draw button | `Draw a nugget` · dialog title `Your challenge` · `Reroll` |
| Title validation | `A nugget needs a title.` |
| Empty bank | `Nothing in the bank yet` / `Drop your first nugget in. Half-formed is fine.` |
| Empty search | `No nuggets match` / `Try a different word, or clear the tag filter.` |
| Empty trash | `Trash is empty` / `Archived nuggets land here. Nothing has been binned yet.` |
| Purge confirm | `Purge this nugget?` / `It's gone for good — restoring won't be an option.` |
| Tag preview | `Saved as saas` |

---

## Visual foundations

### Colour

Three families plus a categorical set. Every neutral is warm-biased — **there is no pure grey and no pure black in the system.**

- **Golden** (`--nug-golden-*`, 50→700) is primary. `400 #EFAE3A` is `--accent`; `600 #C1731A` is the crust edge; `700 #95530F` is the only golden dark enough for text on cream. Golden means *press this*.
- **Ketchup** (`--nug-ketchup-*`, 100→600) is the accent. `400 #F2564A` is the focus ring; `500/600` are purge, errors and nothing else. It is deliberately **not** a second CTA colour.
- **Cream & warm ink** are surfaces and text: page `cream-100 #FDF4E3`, cards white, sunken tracks `cream-200 #F7E8CF`, body `ink-900 #2A1C12` (a brown-black), secondary `ink-500 #6F5A44`, tertiary `ink-400 #7A6248`.
- **Only ink-400 and darker may be used as text.** `ink-200 #E4D6C0` and `ink-300 #BFA98F` are **border and divider colours only** — neither clears 4.5:1 on cream, and `--text-subtle` therefore resolves to ink-400, not ink-300. Every ink step from 400 down passes at 11px on white, cream-50 and cream-100.
- **Dips** — mustard, bbq, chilli, herb, curry, ranch — colour the tags. **Derived deterministically from the tag name** by `dipFor(name)`, so the same tag is always the same colour with nothing stored and nothing random. This is an addition: the spec gives tags no colour, and the derivation is a display convention only.

### Type

- **Baloo 2** (display) at 600–800, tracking −0.015em: headings, buttons, nav, idea titles.
- **Figtree** (body) at 400–600: 17px lead, 15px body, 13.5px small, 12.5px uppercase micro-label at 0.06em.
- **DM Mono**: counts, relative dates, the `127.0.0.1:7777` footer, token names. Never sentences.
- Display line-height 1.15–1.2, body 1.5, `text-wrap: pretty` on every heading and paragraph.

### Spacing & layout

4px-based with fine steps at the bottom (2, 4, 6, 8) for icon gaps. The app is a **single centred column, max 900px**, 24px gutters, 12px between list rows, 16–18px inside a row. Top bar is 60px and is the only fixed element — there is no sidebar and nothing else pins. Minimum hit target 44px. Density is balanced: full-width rows, two-line note clamp, six to eight rows visible at once.

### Shape & borders

- Radii `6 / 10 / 14 / 20 / 28px` plus pill. **Inputs 14, dialogs 28; every button, tag and chip is a pill.**
- **Idea cards are fluid.** `IdeaCard` derives eight corner values from a hash of the title (clamped 14–34px), so every nugget sits at a slightly different soft shape — the way no two real nuggets match — while staying a legible rectangle. It is deterministic: same nugget, same shape, every render. `shape="soft"` pins a card back to `--radius-lg` for dense or data-heavy contexts where the wobble reads as misalignment.
- **Bites are meaning, not decoration.** `bitten` takes a scalloped chunk out of a card's top edge, and `NuggetMark` has bitten variants of the single and trio illustrations. A bite means *this one has been eaten* — an idea drawn as a challenge, or a page that has run out. One per view, never on an ordinary row, and never on a first-run empty state where nothing has been eaten yet. Set `biteBackground` to whatever the card sits on.
- **The nugget blob** (`--radius-nugget: 58% 42% 46% 54% / 52% 46% 54% 48%`) is the signature shape — an asymmetric organic oval on tag dots, the draw-button glyph, and decorative shapes. **Never** on inputs, rows, or anything holding a long line of text.
- Three border weights, each with a job: **1px hairline** for dividers and chrome edges, **1.5px regular** for rows, inputs and tags, **2px chunky** for dialogs. Borders are more load-bearing than shadows here — the system reads as drawn, not floated.

### Shadow, elevation & the crust edge

Every shadow is `rgba(42,28,18,·)` — brown-black, warm, **never blue**. `--shadow-1` resting rows, `--shadow-2` hover, `--shadow-3` dialogs.

The signature move is the **crust edge**: a flat, blur-free offset shadow (`0 3px 0 var(--nug-golden-600)`) under buttons, like the darker fried underside of a nugget. On press it compresses to 1px and the element drops 2px, so buttons feel physically pushable. Ghost buttons are the only variant without it.

### Backgrounds & texture

Flat colour. No photography, no gradient meshes, **no blue-purple gradients**. The only pattern is the breading speckle (`--texture-breading`) — three low-opacity radial dots tiled at 26–54px — used behind empty-state illustrations. Never behind body copy or a form.

### Illustration

Flat vector in `assets/`: solid fills, a 3.5px `#95530F` outline, a lighter inner highlight, a few `golden-600` breading speckles. Four pieces: single nugget, trio, bucket, dip cup. Warm and saturated, no grain, no shading gradients. Always paired with a text label.

### Motion

- `140ms` hover/focus · `200ms` toggles and lifts · `320ms` dialogs · `520ms` page reveals.
- `--ease-bounce: cubic-bezier(.34,1.56,.64,1)` is the **house easing** — anything that appears or is picked up overshoots slightly. `--ease-out` handles exits and colour changes.
- Idea rows lift `−2px` and tilt `−0.25°` on hover, as if being picked out of a basket. **Nothing spins, slides across the screen, or parallaxes.** All durations collapse to 0 under `prefers-reduced-motion`.

### Interaction states

- **Hover:** filled controls step one shade darker (golden-400 → 500); transparent ones step one shade warmer (transparent → cream-200). Never opacity fades.
- **Press:** the crust edge compresses 3px → 1px and the element drops 2px. No colour change — the movement is the feedback.
- **Focus:** a 1.5px golden-500 border plus a 3px `rgba(242,86,74,.35)` ketchup glow. Focus is ketchup so it can never read as hover.
- **Selected:** the tag fills solid with its dip colour; the "All" chip fills ink.
- **Disabled:** 45% opacity, `not-allowed`, no state changes.

### Transparency & blur

One place only: the dialog scrim, `rgba(42,28,18,.44)` with a 3px backdrop blur. No frosted headers, no translucent cards, no glassmorphism.

---

## Iconography

- **Lucide 0.462.0**, CDN-loaded, rendered as `<i data-lucide="name">` + `lucide.createIcons()`. **Flagged substitution** — no icon set was specified; Lucide's rounded caps and even stroke sit closest to Baloo 2.
- **Stroke 2.2px** (heavier than Lucide's 2px default, to match the chunky borders). **16px** inline, **20px** maximum. Icons inherit `currentColor` and are never coloured independently of their label.
- Icons used in the app: `plus`, `pencil`, `archive`, `trash-2`, `arrow-left`, `search`, `x`, `chevron-down`.
- **Icons are never alone without a label.** `IconButton` requires a `label` prop, which becomes its `aria-label` and title.
- **No icon font, no sprite sheet, no PNG icons.** Inline SVG only.
- **No emoji as iconography, ever.** Unicode is used for exactly one glyph: `×` for remove/dismiss inside tags and fields.
- The **nugget blob** does iconographic work the icon set can't: the dot on every tag and the glyph on the draw button. That is intentional.

---

## Index

### Root
- `styles.css` — the single entry point consumers link. `@import` lines only.
- `readme.md` — this file.
- `SKILL.md` — Agent-Skill wrapper, for using this system from Claude Code.
- `github.md` — source-repo association and last sync.
- `thumbnail.html` — homepage tile.

### `tokens/`
`fonts.css` (Google Fonts import + substitution note) · `colors.css` · `typography.css` · `spacing.css` · `shape.css` · `motion.css` · `base.css` (resets, link colours).

### `assets/`
`nugget.svg` · `nugget-alt.svg` · `nugget-bitten.svg` · `nugget-trio.svg` · `nugget-trio-bitten.svg` · `bucket.svg` · `dip-cup.svg`

### `guidelines/`
20 specimen cards, grouped **Colors** (golden, ketchup, neutrals, dips, semantic roles), **Type** (display, body, mono), **Spacing** (scale, layout tokens, in-use), **Shape** (radii, the nugget blob, fluid card shapes & bites, borders, shadows & crust edge), **Motion**, **Brand** (motif, wordmark, breading texture).

### Components

Each has `<Name>.jsx`, `<Name>.d.ts` and `<Name>.prompt.md`, with one `@dsCard` HTML per directory.

**From the spec's frontend structure (§7):**
- **`components/nuggets/`** — `IdeaList`, `IdeaCard`, `TagFilter`, `TagCombobox`, `IdeaForm`, `RandomNugget`, `TrashView`

**Primitives those compose:**
- **`components/core/`** — `Button`, `IconButton`, `Tag`, `Badge`, `Card`
- **`components/forms/`** — `Input`, `Textarea`, `SearchField`
- **`components/feedback/`** — `Dialog`, `EmptyState`
- **`components/navigation/`** — `TopBar`
- **`components/brand/`** — `Wordmark`, `NuggetMark`

Full list: `Badge`, `Button`, `Card`, `Dialog`, `EmptyState`, `IconButton`, `IdeaCard`, `IdeaForm`, `IdeaList`, `Input`, `NuggetMark`, `RandomNugget`, `SearchField`, `Tag`, `TagCombobox`, `TagFilter`, `Textarea`, `TopBar`, `TrashView`, `Wordmark`.

#### Intentional additions

The spec names six frontend components; everything else here is an addition, kept as small as the product allows:

- `Button`, `IconButton`, `Input`, `Textarea`, `SearchField`, `Dialog` — unavoidable primitives. `Dialog` corresponds to the one shadcn component the spec adopts.
- `IdeaCard` — the row `IdeaList` is made of, split out so the trash view can reuse it.
- `Tag` — the visual atom shared by `TagFilter` and `TagCombobox`, plus `dipFor()` for deterministic tag colour.
- `EmptyState` — every list needs one, and the spec's success criteria depend on the app being usable from empty.
- `TopBar` — the app's only chrome, holding search and the three actions.
- `Badge`, `Card` — general-purpose, used lightly.
- `Wordmark`, `NuggetMark` — stand in for the missing logo.

#### Deliberately absent

`Select`, `Checkbox`, `Switch`, `Toast`, `Tooltip`, `Tabs`, `SideNav`, `TabBar`, `Avatar` and any always-on capture bar. Each was ruled out by the spec: no settings screen, no toast system, one screen with no sidebar or tabs, no accounts, and creation happens in a dialog. They were drafted before the repo was readable and removed once it was.

### `prototype/`
**`prototype/index.html`** — the clickable prototype. One page, three surfaces behind a switcher, each in device chrome: the marketing site and desktop app in a browser window, the phone in an iOS frame. Everything inside is live and interactive, not a screenshot.

### `ui_kits/`
- **`ui_kits/web_app/`** — *recreation.* The MVP: bank list, search, tag filter, drop/edit dialog with tag autocomplete, archive, trash with restore and purge, and the random draw.
- **`ui_kits/mobile_app/`** — *speculative.* Mobile is out of scope in the spec (§2), but §9.1 keeps the door open: Tailscale onto the tailnet, zero code changes, "the remaining work is a responsive CSS pass". This kit is that pass — same screen, same dialogs, same endpoints, re-laid-out for 390px.
- **`ui_kits/marketing_site/`** — *speculative.* No marketing site exists or is specified. All copy is lifted from the repo README and the page states plainly that the project is designed but not built.

Each kit has its own `README.md` with a screen → endpoint mapping and, for the two speculative kits, a note on exactly what was invented.
