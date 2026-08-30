Create/edit dialog. One of only two dialogs in the app.

```jsx
<IdeaForm open={open} mode="create" tagOptions={allTags} onSubmit={save} onClose={close} />
```

Submit copy is "Drop it in" on create, "Save" on edit. Validation and server errors both render inline under the title field.
