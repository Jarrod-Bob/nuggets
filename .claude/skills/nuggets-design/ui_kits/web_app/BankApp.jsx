const { TopBar, SearchField, Button, IconButton, IdeaCard, TagFilter, IdeaForm, RandomNugget, TrashView, EmptyState, Dialog, Wordmark } = window.NuggetsDesignSystem_33854b;

const icon = (name, size = 16) => React.createElement('i', { 'data-lucide': name, style: { width: size, height: size, display: 'flex' } });

function NuggetsApp() {
  const seed = window.NUG_SEED;
  const [ideas, setIdeas] = React.useState(seed.ideas);
  const [archived, setArchived] = React.useState(seed.archived);
  const [query, setQuery] = React.useState('');
  const [tag, setTag] = React.useState(null);
  const [view, setView] = React.useState('bank');
  const [form, setForm] = React.useState(null);
  const [purge, setPurge] = React.useState(null);

  React.useEffect(() => { if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 2.2 } }); });

  const tagCounts = seed.tags
    .map(t => ({ name: t, count: ideas.filter(i => i.tags.includes(t)).length }))
    .filter(t => t.count > 0);

  const q = query.trim().toLowerCase();
  const shown = ideas.filter(i =>
    (!q || i.title.toLowerCase().includes(q) || (i.notes || '').toLowerCase().includes(q)) &&
    (!tag || i.tags.includes(tag)));

  const save = (draft) => {
    if (form && form.mode === 'edit') {
      setIdeas(list => list.map(i => i.id === form.idea.id ? { ...i, ...draft } : i));
    } else {
      setIdeas(list => [{ id: Date.now(), ...draft, date: 'just now' }, ...list]);
    }
    setForm(null);
  };
  const archive = (id) => {
    const it = ideas.find(i => i.id === id);
    setIdeas(list => list.filter(i => i.id !== id));
    setArchived(list => [{ ...it, archivedAt: 'binned just now' }, ...list]);
  };
  const restore = (id) => {
    const it = archived.find(i => i.id === id);
    setArchived(list => list.filter(i => i.id !== id));
    setIdeas(list => [{ ...it, date: 'restored just now' }, ...list]);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', display: 'flex', flexDirection: 'column' }}>
      <TopBar
        center={view === 'bank'
          ? <SearchField value={query} onChange={e => setQuery(e.target.value)} onClear={() => setQuery('')} style={{ width: 340 }} />
          : <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-title-3)' }}>Trash</span>}
        right={<>
          {view === 'bank' && <RandomNugget tag={tag} onDraw={() => shown.length ? shown[Math.floor(Math.random() * shown.length)] : null} />}
          <Button variant="ghost" size="sm" onClick={() => setView(view === 'bank' ? 'trash' : 'bank')}
            iconLeft={icon(view === 'bank' ? 'trash-2' : 'arrow-left')}>
            {view === 'bank' ? `Trash${archived.length ? ' · ' + archived.length : ''}` : 'Back to the bank'}
          </Button>
          <Button onClick={() => setForm({ mode: 'create' })} iconLeft={icon('plus')}>Drop a nugget</Button>
        </>} />

      <main style={{ flex: 1, width: '100%', maxWidth: 1240, margin: '0 auto', padding: '28px var(--gutter-web) 72px' }}>
        {view === 'bank' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
              <h1 style={{ fontSize: 'var(--text-title-1)' }}>The bank</h1>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-500)' }}>
                {shown.length} of {ideas.length} nuggets
              </span>
            </div>
            <TagFilter tags={tagCounts} value={tag} onChange={setTag} />
            {shown.length === 0 ? (
              <EmptyState
                headline={q || tag ? 'No nuggets match' : 'Nothing in the bank yet'}
                body={q || tag ? 'Try a different word, or clear the tag filter.' : 'Drop your first nugget in. Half-formed is fine.'}
                action={<Button onClick={() => setForm({ mode: 'create' })}>Drop a nugget</Button>} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {shown.map(i => (
                  <IdeaCard key={i.id} title={i.title} notes={i.notes} tags={i.tags} date={i.date}
                    onClick={() => setForm({ mode: 'edit', idea: i })}
                    actions={<span style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
                      <IconButton label="Edit" onClick={() => setForm({ mode: 'edit', idea: i })}>{icon('pencil')}</IconButton>
                      <IconButton label="Archive" onClick={() => archive(i.id)}>{icon('archive')}</IconButton>
                    </span>} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <TrashView ideas={archived} onRestore={restore} onPurge={id => setPurge(archived.find(a => a.id === id))} />
        )}
      </main>

      <footer style={{ padding: '0 var(--gutter-web) 22px', display: 'flex', justifyContent: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--nug-ink-500)' }}>
          127.0.0.1:7777 · single user · one SQLite file
        </span>
      </footer>

      <IdeaForm open={!!form} mode={form ? form.mode : 'create'} idea={form ? form.idea : undefined}
        tagOptions={seed.tags} onSubmit={save} onClose={() => setForm(null)} />

      <Dialog open={!!purge} width={430} title="Purge this nugget?"
        description={purge ? `"${purge.title}" is gone for good — restoring won't be an option.` : ''}
        onClose={() => setPurge(null)}
        footer={<>
          <Button variant="ghost" onClick={() => setPurge(null)}>Keep it</Button>
          <Button variant="danger" onClick={() => { setArchived(list => list.filter(a => a.id !== purge.id)); setPurge(null); }}>Purge</Button>
        </>} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<NuggetsApp />);
