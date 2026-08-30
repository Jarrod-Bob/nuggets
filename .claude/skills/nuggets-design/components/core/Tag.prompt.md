A freeform tag. Outlined at rest; filled with its dip colour when `active` (i.e. used as a filter).

```jsx
<Tag name="saas" count={12} active onClick={() => toggle('saas')} />
<Tag name="hardware" onRemove={() => drop('hardware')} />
```

Tag names are always lowercase — the API normalises to trimmed lowercase on every write, so `#SaaS` and `#saas` are the same tag. Colour is derived from the name by `dipFor`, never stored and never random.
