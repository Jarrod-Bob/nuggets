// Seed data for the UI kit. Shapes match the API in
// docs/superpowers/specs/2026-08-29-nuggets-design.md section 6.
window.NUG_SEED = {
  ideas: [
    { id: 7, title: 'Tailnet-only sharing', notes: 'Expose the bank over Tailscale so the phone can reach it. No accounts, no hosting bill, no code changes to the Go binary.', tags: ['go', 'infra'], date: '2d ago' },
    { id: 6, title: 'Draw a nugget, then timebox it', notes: 'The random draw picks an idea and starts a 25-minute timer alongside it. Turns the mini-challenge into an actual session.', tags: ['product'], date: '4d ago' },
    { id: 5, title: 'Golden-JSON test for every API shape', notes: 'One testdata file per response type, compared byte-for-byte, so the hand-written TS types can never drift silently.', tags: ['go', 'testing'], date: '6d ago' },
    { id: 4, title: 'Telegram drain command', notes: 'A one-off script that reads the self-message thread and files each message as a nugget. Fixes the backlog, not the habit.', tags: ['product', 'infra'], date: '1w ago' },
    { id: 3, title: 'Status field: raw → building → parked', notes: 'Deliberately out of scope for the MVP. One migration adding nullable columns when it earns its place.', tags: ['product'], date: '2w ago' },
    { id: 2, title: 'FTS5 search when LIKE stops being enough', notes: 'The driver already ships FTS5. Not worth it below a few thousand rows.', tags: ['go', 'search'], date: '3w ago' },
  ],
  archived: [
    { id: 1, title: 'Chrome extension for capture', notes: 'Superseded by tailnet access — a browser extension only helps at a desk.', tags: ['browser'], archivedAt: 'binned 3d ago' },
  ],
  tags: ['go', 'infra', 'product', 'testing', 'search', 'browser'],
};
