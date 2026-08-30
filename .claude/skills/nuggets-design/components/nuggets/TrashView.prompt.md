The trash list. Every row offers Restore and Purge; Purge is the only `danger` button in the app.

```jsx
<TrashView ideas={archived} onRestore={restore} onPurge={purge} />
```

Losing an idea should take deliberate effort — confirm purges, and never put an archived row in the active list.
