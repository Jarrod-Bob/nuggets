The whole main view: search, tag filter, newest-first rows, and the empty state. Composes `SearchField`, `TagFilter`, `IdeaCard` and `EmptyState`.

```jsx
<IdeaList ideas={ideas} tags={tags} query={q} activeTag={tag}
  onQueryChange={e => setQ(e.target.value)} onTagChange={setTag}
  rowActions={i => <IconButton label="Archive" onClick={() => archive(i.id)}>…</IconButton>} />
```

The empty copy changes depending on whether a filter is active — "No nuggets match" vs "Nothing in the bank yet".
