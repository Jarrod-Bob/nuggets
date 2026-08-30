Button + result dialog for the random draw. Renders both — mount it once in the header.

```jsx
<RandomNugget tag={activeTag} onDraw={t => pickRandom(t)} />
```

Reroll is always available and costs nothing; the endpoint records no state. When the draw comes back empty, say so plainly rather than hiding the dialog.
