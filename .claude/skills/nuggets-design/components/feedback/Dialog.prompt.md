Modal for creating a bucket, editing a nugget, confirming a delete. Returns null when `open` is false.

```jsx
<Dialog open={open} title="New bucket" onClose={close} footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button onClick={create}>Create</Button></>}>
  <Input label="Name" />
</Dialog>
```
