const { SearchField, Button, IconButton, IdeaCard, TagFilter, IdeaForm, RandomNugget, TrashView, EmptyState, Dialog, Wordmark } = window.NuggetsDesignSystem_33854b;

const icon = (name, size = 16) => React.createElement('i', { 'data-lucide': name, style: { width: size, height: size, display: 'flex' } });

function MobileApp() {
  const seed = window.NUG_SEED;
  const [ideas, setIdeas] = React.useState(seed.ideas);
  const [archived, setArchived] = React.useState(seed.archived);
  const [query, setQuery] = React.useState('');
  const [tag, setTag] = React.useState(null);
  const [view, setView] = React.useState('bank');
  const [form, setForm] = React.useState(null);
  const [purge, setPurge] = React.useState(null);

  React.useEffect(() => { if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 2.2 } }); });

  const counts = seed.tags.map(t => ({ name: t, count: ideas.filter(i => i.tags.includes(t)).length })).filter(t => t.count > 0);
  const q = query.trim().toLowerCase();
  const shown = ideas.filter(i => (!q || i.title.toLowerCase().includes(q) || (i.notes || '').toLowerCase().includes(q)) && (!tag || i.tags.includes(tag)));

  const save = (draft) => {
    if (form && form.mode === 'edit') setIdeas(l => l.map(i => i.id === form.idea.id ? { ...i, ...draft } : i));
    else setIdeas(l => [{ id: Date.now(), ...draft, date: 'just now' }, ...l]);
    setForm(null);
  };
  const archive = (id) => { const it = ideas.find(i => i.id === id); setIdeas(l => l.filter(i => i.id !== id)); setArchived(l => [{ ...it, archivedAt: 'binned just now' }, ...l]); };
  const restore = (id) => { const it = archived.find(i => i.id === id); setArchived(l => l.filter(i => i.id !== id)); setIdeas(l => [{ ...it, date: 'restored just now' }, ...l]); };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', display: 'flex', flexDirection: 'column', paddingBottom: 96 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--nug-cream-50)', borderBottom: 'var(--border-hairline) solid var(--nug-ink-200)', padding: '10px var(--gutter-mobile) 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
          {view === 'bank' ? <Wordmark size={20} /> : <h1 style={{ fontSize: 'var(--text-title-3)' }}>Trash</h1>}
          <span style={{ flex: 1 }} />
          {view === 'bank' && <RandomNugget buttonLabel="Draw" onDraw={() => shown.length ? shown[Math.floor(Math.random() * shown.length)] : null} tag={tag} />}
          <IconButton label={view === 'bank' ? 'Trash' : 'Back to the bank'} variant="outline" onClick={() => setView(view === 'bank' ? 'trash' : 'bank')}>
            {icon(view === 'bank' ? 'trash-2' : 'arrow-left')}
          </IconButton>
        </div>
        {view === 'bank' && <SearchField value={query} onChange={e => setQuery(e.target.value)} onClear={() => setQuery('')} />}
      </header>

      <main style={{ flex: 1, padding: '14px var(--gutter-mobile) 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {view === 'bank' ? (<>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, margin: '0 calc(var(--gutter-mobile) * -1)', padding: '0 var(--gutter-mobile) 2px' }}>
            <TagFilter tags={counts} value={tag} onChange={setTag} style={{ flexWrap: 'nowrap' }} />
          </div>
          {shown.length === 0 ? (
            <EmptyState headline={q || tag ? 'No nuggets match' : 'Nothing in the bank yet'}
              body={q || tag ? 'Try a different word, or clear the tag filter.' : 'Drop your first nugget in. Half-formed is fine.'}
              action={<Button onClick={() => setForm({ mode: 'create' })}>Drop a nugget</Button>} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {shown.map(i => (
                <IdeaCard key={i.id} title={i.title} notes={i.notes} tags={i.tags} date={i.date} seed={String(i.id)}
                  onClick={() => setForm({ mode: 'edit', idea: i })}
                  actions={<span onClick={e => e.stopPropagation()}><IconButton label="Archive" onClick={() => archive(i.id)}>{icon('archive')}</IconButton></span>} />
              ))}
            </div>
          )}
        </>) : (
          <TrashView ideas={archived} onRestore={restore} onPurge={id => setPurge(archived.find(a => a.id === id))} />
        )}
      </main>

      {view === 'bank' && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '14px var(--gutter-mobile) 22px', background: 'linear-gradient(to top, var(--surface-page) 62%, rgba(253,244,227,0))' }}>
          <Button fullWidth size="lg" onClick={() => setForm({ mode: 'create' })} iconLeft={icon('plus', 18)}>Drop a nugget</Button>
        </div>
      )}

      <IdeaForm open={!!form} mode={form ? form.mode : 'create'} idea={form ? form.idea : undefined} tagOptions={seed.tags} onSubmit={save} onClose={() => setForm(null)} />
      <Dialog open={!!purge} width={330} title="Purge this nugget?"
        description={purge ? `"${purge.title}" is gone for good.` : ''} onClose={() => setPurge(null)}
        footer={<><Button variant="ghost" onClick={() => setPurge(null)}>Keep it</Button><Button variant="danger" onClick={() => { setArchived(l => l.filter(a => a.id !== purge.id)); setPurge(null); }}>Purge</Button></>} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<MobileApp />);
