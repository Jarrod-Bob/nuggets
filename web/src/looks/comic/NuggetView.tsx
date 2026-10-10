import './nugget.css';
import { Link } from 'react-router-dom';
import type { Idea, Tag as TagRecord } from '../../api';
import { TopBar } from '../../components/navigation/TopBar';
import { IdeaForm } from '../../components/nuggets/IdeaForm';
import { formatRelative } from '../../lib/formatRelative';
import { describeOrigin } from '../../lib/origin';
import type { NuggetPageModel } from '../../models/useNuggetPage';
import { ActionError, Button, CardArt, CaptionBox, Dialog, EmptyState, shapeSeed, StatusPill, Tag } from './ui';

/**
 * The Edit nugget dialog. The one place the page names its form: today
 * Classic's IdeaForm (the Comic dialog is #54), so swapping it is a change here.
 */
function EditDialog({ page, idea, tags }: { page: NuggetPageModel; idea: Idea; tags: TagRecord[] }) {
  return (
    <IdeaForm
      open={page.editing}
      mode="edit"
      idea={idea}
      tagOptions={tags.map((t) => t.name)}
      onSubmit={page.submitEdit}
      onClose={page.stopEditing}
      onDirtyChange={page.setFormDirty}
      notice={page.changedWhileEditing ? 'New nuggets arrived while you were editing. This page catches up once you save or cancel.' : undefined}
      error={page.formError}
    />
  );
}

/**
 * One nugget's page in the Comic look: a hero panel beside the title and notes
 * panels, a tomato action panel below. Everything it draws comes from the
 * `page` model (ADR 0002), the same one Classic's NuggetView takes, with the
 * same labels and accessible names, so the page tests pass under both Looks.
 */
export function NuggetView({ page }: { page: NuggetPageModel }) {
  const { load, idea, archived, tags } = page;

  return (
    <>
      <TopBar
        center={null}
        right={
          <Button size="sm" icon="arrow-left" onClick={page.backToBank}>
            Back to the bank
          </Button>
        }
      />

      <main className="comic-nugget">
        <ActionError message={page.actionError} onDismiss={page.dismissActionError} />

        {load.status === 'loading' && (
          <CaptionBox eyebrow="Meanwhile…" role="status">
            Fetching this nugget…
          </CaptionBox>
        )}

        {load.status === 'notfound' && (
          <EmptyState
            eyebrow="Meanwhile, on the tray…"
            headline="Not in the bank"
            body={load.message}
            action={
              <Button variant="tomato" size="sm" onClick={page.backToBank}>
                Back to the bank
              </Button>
            }
          />
        )}

        {idea && (
          <article className={archived ? 'comic-nugget-grid comic-nugget-grid--binned' : 'comic-nugget-grid'}>
            <section className="comic-panel comic-nugget-hero" aria-label="The nugget">
              <div className="comic-nugget-art">
                <CardArt shape={shapeSeed(idea.id)} status={idea.status} />
              </div>
              <StatusPill status={idea.status} />
              {archived && <span className="comic-nugget-binned">In the trash</span>}
            </section>

            <section className="comic-panel comic-nugget-title">
              <h1 className="comic-nugget-h1">{idea.title}</h1>
              {idea.project_name && (
                <p className="comic-nugget-project">
                  <span role="note" aria-label={`Suggested project name: ${idea.project_name}`} title="Suggested project name" className="comic-nugget-project-name">
                    {idea.project_name}
                  </span>
                </p>
              )}
              {(idea.tags.length > 0 || page.showSuggestions) && (
                <div className="comic-nugget-tags">
                  {idea.tags.map((t) => (
                    <Link key={t} to={page.tagHref(t)} aria-label={t} className="comic-nugget-tag">
                      <Tag name={t} />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="comic-panel comic-nugget-notes" aria-label="Notes">
              {idea.notes ? <p className="comic-nugget-notes-text">{idea.notes}</p> : <p className="comic-nugget-notes-empty">No notes yet.</p>}
              <p className="comic-nugget-dates">
                {/* An imported nugget's origin line replaces "captured": both would name the same moment. */}
                <span>{describeOrigin(idea) ?? `captured ${formatRelative(idea.created_at)}`}</span>
                {idea.updated_at !== idea.created_at && <span>last changed {formatRelative(idea.updated_at)}</span>}
                {idea.archived_at && <span>binned {formatRelative(idea.archived_at)}</span>}
              </p>
            </section>

            <section className="comic-panel comic-nugget-actions" aria-label="Actions">
              {archived ? (
                <Button onClick={page.restore}>Restore</Button>
              ) : (
                <>
                  <Button onClick={page.openPlan}>Plan with Claude</Button>
                  <Button icon="pencil" onClick={page.startEditing}>
                    Edit
                  </Button>
                  <Button icon="archive" onClick={page.archive}>
                    Archive
                  </Button>
                </>
              )}
              <Button variant="danger" icon="trash" onClick={page.askPurge}>
                Purge
              </Button>
            </section>
          </article>
        )}
      </main>

      {idea && <EditDialog page={page} idea={idea} tags={tags} />}

      {page.purging && (
        <Dialog
          width={430}
          title="Purge this nugget?"
          description="It's gone for good — restoring won't be an option."
          onClose={page.cancelPurge}
          footer={
            <>
              <Button onClick={page.cancelPurge}>Keep it</Button>
              <Button variant="danger" onClick={page.confirmPurge}>
                Purge
              </Button>
            </>
          }
        />
      )}
    </>
  );
}

// React.lazy takes the default export; the page route loads this module on demand.
export default NuggetView;
