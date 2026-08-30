Tag entry with autocomplete. Used inside `IdeaForm`. Options come from `GET /api/tags` and are filtered client-side — the vocabulary of one person is small.

```jsx
<TagCombobox value={tags} options={allTags} onChange={setTags} />
```

Never uppercase a tag in the UI, and never let the client be the one that normalises — show the preview, let the API decide.
