A row in the idea list. The list is newest-first and full-width — not a masonry grid.

```jsx
<IdeaCard title="Tailnet-only sharing" notes="Expose the bank over Tailscale, no accounts." tags={['go','infra']} date="2d ago"
  actions={<IconButton label="Archive">…</IconButton>} />
```

**Shape.** `shape="fluid"` (the default) derives eight corner radii from the title, so every nugget sits at a slightly different soft shape. It is deterministic — same title, same shape, every render. Pass `seed={String(idea.id)}` when titles are editable so a rename doesn't reshape the card. Use `shape="soft"` in dense or data-heavy contexts where the wobble reads as misalignment.

**Bites.** `bitten` takes a chomp out of the top-right corner — two tooth marks and a couple of stray crumbs, not a scallop along the edge. It means *this one has been eaten* — an idea that's been drawn as a challenge, or shipped. Never decorate an ordinary card with it, and never bite more than one card in view. Set `biteBackground` to whatever the card sits on, or the bite fills with the wrong colour.

Pass `archived` in the trash view. Notes are clamped to two lines; the row is a glance, not a read.
