import React from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { TopBar } from '../components/navigation/TopBar';
import { Button } from '../components/core/Button';
import { Tag } from '../components/core/Tag';
import { Dialog } from '../components/feedback/Dialog';
import { EmptyState } from '../components/feedback/EmptyState';
import { IdeaForm, type IdeaDraft } from '../components/nuggets/IdeaForm';
import { Main } from '../components/Shell';
import { ActionError } from '../components/feedback/ActionError';
import { iconArrowLeft, iconPencil } from '../components/icons';
import { FeatureRequests } from '../components/nuggets/FeatureRequests';
import { api, ApiError, type FeatureRequest, type Idea } from '../api';
import { formatRelative } from '../lib/formatRelative';
import { describeOrigin } from '../lib/origin';
import { parseNuggetId } from '../routing/nuggetPath';
import { paramsFromFilter } from '../routing/listFilter';
import { useTags } from '../tags/TagsProvider';
import { useLiveRefresh } from '../live/LiveUpdates';

const describeError = (err: unknown): string => (err instanceof ApiError ? err.message : 'Something went wrong.');

/** The URL that filters the bank to one tag — where each tag on the page links. */
const tagFilterHref = (tag: string): string => `/?${paramsFromFilter({ tag }).toString()}`;

type Load = { status: 'loading' } | { status: 'notfound'; message: string } | { status: 'ready'; idea: Idea };

export function NuggetPage() {
  const navigate = useNavigate();
  const { tags, refresh: refreshTags } = useTags();
  const { id: idParam } = useParams();
  // A non-numeric :id never reaches the API — it resolves to the not-found page.
  const id = parseNuggetId(idParam);

  const [load, setLoad] = React.useState<Load>(() =>
    id === null ? { status: 'notfound', message: "That nugget isn't in the bank." } : { status: 'loading' },
  );
  const [actionError, setActionError] = React.useState<string | undefined>(undefined);

  const reload = React.useCallback(() => {
    if (id === null) return;
    let live = true;
    api
      .get(id)
      .then((idea) => {
        if (live) setLoad({ status: 'ready', idea });
      })
      .catch((err) => {
        if (!live) return;
        const gone = err instanceof ApiError && err.status === 404;
        setLoad((prev) =>
          !gone && prev.status === 'ready' && prev.idea.id === id ? prev : { status: 'notfound', message: describeError(err) },
        );
      });
    return () => {
      live = false;
    };
  }, [id]);
  React.useEffect(() => reload(), [reload]);

  // The nugget's GitHub feature requests, fetched alongside it. A failed fetch
  // keeps whatever was showing: this line is secondary to the nugget itself.
  const [requests, setRequests] = React.useState<FeatureRequest[]>([]);
  const [retrying, setRetrying] = React.useState<number | null>(null);
  const reloadRequests = React.useCallback(() => {
    if (id === null) return;
    let live = true;
    api.github
      .issues(id)
      .then((list) => {
        if (live && Array.isArray(list)) setRequests(list);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id]);
  React.useEffect(() => reloadRequests(), [reloadRequests]);
  // The sender says when a request was created, failed or is waiting to retry.
  useLiveRefresh('github-changed', () => {
    reloadRequests();
  });

  // The pencil in the list navigates here with ?edit=1 to open editing straight
  // away; a plain open starts in view mode. Read once — the toggle is local from
  // then on.
  const [searchParams] = useSearchParams();
  const [editing, setEditing] = React.useState(searchParams.get('edit') === '1');
  const [formError, setFormError] = React.useState<string | undefined>(undefined);
  const [formDirty, setFormDirty] = React.useState(false);

  // A background import may have refreshed this nugget. Reloading it resets the
  // edit form to the new version, so while the form holds unsaved edits the
  // reload waits until it closes, and the form says why.
  const { pending: changedWhileEditing } = useLiveRefresh(
    'ideas-changed',
    () => {
      reload();
      // A spices import that tagged this nugget may have queued a request.
      reloadRequests();
    },
    { hold: editing && formDirty },
  );

  const [purging, setPurging] = React.useState(false);

  const idea = load.status === 'ready' ? load.idea : null;

  const submitEdit = (draft: IdeaDraft) => {
    if (!idea) return;
    api
      .update(idea.id, draft)
      .then(() => {
        setEditing(false);
        setFormError(undefined);
        setActionError(undefined);
        refreshTags();
        reload();
        // Adding a mapped tag queues a feature request.
        reloadRequests();
      })
      .catch((err) => setFormError(describeError(err)));
  };

  const retryRequest = (requestId: number) => {
    setRetrying(requestId);
    api.github
      .retry(requestId)
      .then(() => {
        setActionError(undefined);
        reloadRequests();
      })
      .catch((err) => setActionError(describeError(err)))
      .finally(() => setRetrying(null));
  };

  const archiveIdea = () => {
    if (!idea) return;
    api
      .archive(idea.id)
      .then(() => {
        refreshTags();
        // Archived from its own page — nothing left to look at, back to the bank.
        navigate('/');
      })
      .catch((err) => setActionError(describeError(err)));
  };
  const restoreIdea = () => {
    if (!idea) return;
    api
      .restore(idea.id)
      .then(() => {
        setActionError(undefined);
        refreshTags();
        reload();
      })
      .catch((err) => setActionError(describeError(err)));
  };
  const confirmPurge = () => {
    if (!idea) return;
    api
      .purge(idea.id)
      .then(() => {
        setPurging(false);
        refreshTags();
        navigate('/');
      })
      .catch((err) => setActionError(describeError(err)));
  };

  const backButton = (
    <Button variant="ghost" size="sm" onClick={() => navigate('/')} iconLeft={iconArrowLeft}>
      Back to the bank
    </Button>
  );
  const archived = !!idea?.archived_at;

  return (
    <>
      <TopBar
        center={null}
        right={
          idea ? (
            <>
              {archived ? (
                <Button variant="secondary" size="sm" onClick={restoreIdea}>
                  Restore
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(true)} iconLeft={iconPencil}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={archiveIdea}>
                    Archive
                  </Button>
                </>
              )}
              <Button variant="danger" size="sm" onClick={() => setPurging(true)}>
                Purge
              </Button>
              {backButton}
            </>
          ) : (
            backButton
          )
        }
      />

      <Main>
        <ActionError message={actionError} onDismiss={() => setActionError(undefined)} />

        {load.status === 'loading' && (
          <p style={{ color: 'var(--nug-ink-500)', fontSize: 'var(--text-body-md)' }}>Fetching this nugget…</p>
        )}

        {load.status === 'notfound' && (
          <EmptyState
            variant="bucket"
            headline="Not in the bank"
            body={load.message}
            action={<Button onClick={() => navigate('/')}>Back to the bank</Button>}
          />
        )}

        {idea && (
          <article
            style={{
              maxWidth: 760,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              padding: '26px 30px',
              background: archived ? 'var(--nug-cream-50)' : 'var(--surface-card)',
              border: 'var(--border-regular) solid var(--nug-ink-200)',
              borderRadius: 'var(--radius-lg)',
              opacity: archived ? 0.92 : 1,
            }}
          >
            {archived && (
              <span style={{ fontSize: 'var(--text-micro)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--nug-ink-500)' }}>
                In the trash
              </span>
            )}

            <h1 style={{ fontSize: 'var(--text-title-1)', fontWeight: 'var(--weight-bold)', textWrap: 'pretty', margin: 0 }}>{idea.title}</h1>

            {idea.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {idea.tags.map((t) => (
                  <Link key={t} to={tagFilterHref(t)} style={{ textDecoration: 'none' }}>
                    <Tag name={t} onClick={() => {}} />
                  </Link>
                ))}
              </div>
            )}

            {idea.notes && (
              <p style={{ margin: 0, fontSize: 'var(--text-body-md)', lineHeight: 'var(--leading-relaxed)', color: 'var(--nug-ink-700)', whiteSpace: 'pre-wrap', textWrap: 'pretty' }}>
                {idea.notes}
              </p>
            )}

            <FeatureRequests requests={requests} onRetry={retryRequest} retrying={retrying} />

            {/*
              Seam for an adjacent issue, deliberately left open here: status and
              links (issue #3) are already part of the model and are edited
              through the form on this page; a dedicated read-only display of
              them on the detail body is the remaining seam.
            */}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--nug-ink-500)' }}>
              {/* An imported nugget's origin line replaces "captured": both would name the same moment. */}
              <span>{describeOrigin(idea) ?? `captured ${formatRelative(idea.created_at)}`}</span>
              {idea.updated_at !== idea.created_at && <span>· last changed {formatRelative(idea.updated_at)}</span>}
              {idea.archived_at && <span>· binned {formatRelative(idea.archived_at)}</span>}
            </div>
          </article>
        )}
      </Main>

      {idea && (
        <IdeaForm
          open={editing}
          mode="edit"
          idea={idea}
          tagOptions={tags.map((t) => t.name)}
          onSubmit={submitEdit}
          onClose={() => {
            setEditing(false);
            setFormError(undefined);
          }}
          onDirtyChange={setFormDirty}
          notice={changedWhileEditing ? 'New nuggets arrived while you were editing. This page catches up once you save or cancel.' : undefined}
          error={formError}
        />
      )}

      <Dialog
        open={purging}
        width={430}
        title="Purge this nugget?"
        description="It's gone for good — restoring won't be an option."
        onClose={() => setPurging(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPurging(false)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={confirmPurge}>
              Purge
            </Button>
          </>
        }
      />
    </>
  );
}
