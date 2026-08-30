import React from 'react';
import { TopBar } from './components/navigation/TopBar';
import { SearchField } from './components/forms/SearchField';
import { Button } from './components/core/Button';
import { IconButton } from './components/core/IconButton';
import { Dialog } from './components/feedback/Dialog';
import { IdeaList, type IdeaListItem } from './components/nuggets/IdeaList';
import { IdeaForm, type IdeaDraft } from './components/nuggets/IdeaForm';
import { RandomNugget, type RandomIdea } from './components/nuggets/RandomNugget';
import { TrashView } from './components/nuggets/TrashView';
import { api, ApiError, type Idea, type Tag } from './api';
import './App.css';

const iconPlus = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const iconTrash = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7h12Z" />
  </svg>
);
const iconArrowLeft = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);
const iconPencil = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const iconArchive = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 8H3M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" />
    <path d="M3 8V5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3" />
  </svg>
);

type FormState = { mode: 'create' } | { mode: 'edit'; idea: Idea } | null;

function App() {
  const [ideas, setIdeas] = React.useState<Idea[]>([]);
  const [tags, setTags] = React.useState<Tag[]>([]);
  const [query, setQuery] = React.useState('');
  const [activeTag, setActiveTag] = React.useState<string | null>(null);
  const [showTrash, setShowTrash] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(null);
  const [formError, setFormError] = React.useState<string | undefined>(undefined);
  const [purgeTarget, setPurgeTarget] = React.useState<Idea | null>(null);
  const [nextRandom, setNextRandom] = React.useState<Idea | null>(null);

  const refreshTags = React.useCallback(() => {
    api.tags().then(setTags).catch(() => {});
  }, []);

  const refreshList = React.useCallback(() => {
    api
      .list({ q: query || undefined, tag: activeTag, archived: showTrash })
      .then(setIdeas)
      .catch(() => {});
  }, [query, activeTag, showTrash]);

  React.useEffect(() => {
    refreshList();
  }, [refreshList]);

  React.useEffect(() => {
    refreshTags();
  }, [refreshTags]);

  // RandomNugget's onDraw is synchronous, but api.random is async, so we keep a
  // one-ahead prefetched draw: the button always returns whatever was fetched
  // last, then immediately kicks off the next fetch (used on open and reroll).
  const fetchNextRandom = React.useCallback((tag: string | null) => {
    api.random(tag).then(setNextRandom).catch(() => setNextRandom(null));
  }, []);
  React.useEffect(() => {
    fetchNextRandom(activeTag);
  }, [activeTag, fetchNextRandom]);
  const handleDraw = (tag: string | null): RandomIdea | null => {
    const result = nextRandom;
    fetchNextRandom(tag);
    return result;
  };

  const openCreate = () => {
    setFormError(undefined);
    setForm({ mode: 'create' });
  };
  const openEdit = (idea: Idea) => {
    setFormError(undefined);
    setForm({ mode: 'edit', idea });
  };
  const closeForm = () => {
    setForm(null);
    setFormError(undefined);
  };

  const submitForm = (draft: IdeaDraft) => {
    const request = form && form.mode === 'edit' ? api.update(form.idea.id, draft) : api.create(draft);
    request
      .then(() => {
        closeForm();
        refreshList();
        refreshTags();
      })
      .catch((err) => {
        setFormError(err instanceof ApiError ? err.message : 'Something went wrong.');
      });
  };

  const archiveIdea = (id: number) => {
    api.archive(id).then(() => {
      refreshList();
      refreshTags();
    });
  };
  const restoreIdea = (id: number) => {
    api.restore(id).then(() => {
      refreshList();
      refreshTags();
    });
  };
  const confirmPurge = () => {
    if (!purgeTarget) return;
    api.purge(purgeTarget.id).then(() => {
      setPurgeTarget(null);
      refreshList();
      refreshTags();
    });
  };

  const listItems: IdeaListItem[] = ideas.map((i) => ({
    id: i.id,
    title: i.title,
    notes: i.notes,
    tags: i.tags,
    date: showTrash ? (i.archived_at ?? undefined) : i.created_at,
  }));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', display: 'flex', flexDirection: 'column' }}>
      <TopBar
        center={
          showTrash ? (
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-title-3)' }}>Trash</span>
          ) : (
            <SearchField value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery('')} style={{ width: 340 }} />
          )
        }
        right={
          <>
            {!showTrash && <RandomNugget tag={activeTag} onDraw={handleDraw} />}
            <Button variant="ghost" size="sm" onClick={() => setShowTrash((v) => !v)} iconLeft={showTrash ? iconArrowLeft : iconTrash}>
              {showTrash ? 'Back to the bank' : 'Trash'}
            </Button>
            <Button onClick={openCreate} iconLeft={iconPlus}>
              Drop a nugget
            </Button>
          </>
        }
      />

      <main style={{ flex: 1, width: '100%', maxWidth: 1240, margin: '0 auto', padding: '28px var(--gutter-web) 72px' }}>
        {showTrash ? (
          <TrashView
            ideas={listItems.map((i) => ({ id: i.id, title: i.title, notes: i.notes, tags: i.tags, archivedAt: i.date }))}
            onRestore={(id) => restoreIdea(Number(id))}
            onPurge={(id) => {
              const target = ideas.find((i) => i.id === Number(id));
              if (target) setPurgeTarget(target);
            }}
          />
        ) : (
          <IdeaList
            ideas={listItems}
            tags={tags}
            query={query}
            activeTag={activeTag}
            onQueryChange={(e) => setQuery(e.target.value)}
            onTagChange={setActiveTag}
            onOpen={(item) => {
              const idea = ideas.find((i) => i.id === item.id);
              if (idea) openEdit(idea);
            }}
            rowActions={(item) => (
              <span style={{ display: 'flex', gap: 2 }} onClick={(e) => e.stopPropagation()}>
                <IconButton
                  label="Edit"
                  onClick={() => {
                    const idea = ideas.find((i) => i.id === item.id);
                    if (idea) openEdit(idea);
                  }}
                >
                  {iconPencil}
                </IconButton>
                <IconButton label="Archive" onClick={() => archiveIdea(Number(item.id))}>
                  {iconArchive}
                </IconButton>
              </span>
            )}
            emptyAction={<Button onClick={openCreate}>Drop a nugget</Button>}
          />
        )}
      </main>

      <footer style={{ padding: '0 var(--gutter-web) 22px', display: 'flex', justifyContent: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--nug-ink-500)' }}>
          127.0.0.1:7777 · single user · one SQLite file
        </span>
      </footer>

      <IdeaForm
        open={!!form}
        mode={form ? form.mode : 'create'}
        idea={form && form.mode === 'edit' ? form.idea : undefined}
        tagOptions={tags.map((t) => t.name)}
        onSubmit={submitForm}
        onClose={closeForm}
        error={formError}
      />

      <Dialog
        open={!!purgeTarget}
        width={430}
        title="Purge this nugget?"
        description="It's gone for good — restoring won't be an option."
        onClose={() => setPurgeTarget(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPurgeTarget(null)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={confirmPurge}>
              Purge
            </Button>
          </>
        }
      />
    </div>
  );
}

export default App;
