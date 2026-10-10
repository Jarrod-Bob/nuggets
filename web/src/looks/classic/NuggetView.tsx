import { Link } from 'react-router-dom';
import { TopBar } from '../../components/navigation/TopBar';
import { Button } from '../../components/core/Button';
import { Tag } from '../../components/core/Tag';
import { Dialog } from '../../components/feedback/Dialog';
import { EmptyState } from '../../components/feedback/EmptyState';
import { IdeaForm } from '../../components/nuggets/IdeaForm';
import { Main } from '../../components/Shell';
import { ActionError } from '../../components/feedback/ActionError';
import { iconArrowLeft, iconPencil } from '../../components/icons';
import { FeatureRequests } from '../../components/nuggets/FeatureRequests';
import { PlanWithClaude } from '../../components/nuggets/PlanWithClaude';
import { ProjectNameLine } from '../../components/nuggets/ProjectNameLine';
import { TagSuggestions } from '../../components/nuggets/TagSuggestions';
import { formatRelative } from '../../lib/formatRelative';
import { describeOrigin } from '../../lib/origin';
import type { NuggetPageModel } from '../../models/useNuggetPage';

/** One nugget's page in the Classic look. */
export function NuggetView({ page }: { page: NuggetPageModel }) {
  const { load, idea, archived, tags, showSuggestions } = page;
  const backButton = (
    <Button variant="ghost" size="sm" onClick={page.backToBank} iconLeft={iconArrowLeft}>
      Back to the bank
    </Button>
  );

  return (
    <>
      <TopBar
        center={null}
        right={
          idea ? (
            <>
              {archived ? (
                <Button variant="secondary" size="sm" onClick={page.restore}>
                  Restore
                </Button>
              ) : (
                <>
                  <Button variant="secondary" size="sm" onClick={page.openPlan}>
                    Plan with Claude
                  </Button>
                  <Button variant="ghost" size="sm" onClick={page.startEditing} iconLeft={iconPencil}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={page.archive}>
                    Archive
                  </Button>
                </>
              )}
              <Button variant="danger" size="sm" onClick={page.askPurge}>
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
        <ActionError message={page.actionError} onDismiss={page.dismissActionError} />

        {load.status === 'loading' && (
          <p style={{ color: 'var(--nug-ink-500)', fontSize: 'var(--text-body-md)' }}>Fetching this nugget…</p>
        )}

        {load.status === 'notfound' && (
          <EmptyState
            variant="bucket"
            headline="Not in the bank"
            body={load.message}
            action={<Button onClick={page.backToBank}>Back to the bank</Button>}
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
            {idea.project_name && <ProjectNameLine projectName={idea.project_name} style={{ marginTop: -4, fontSize: 'var(--text-body-md)' }} />}

            {(idea.tags.length > 0 || showSuggestions) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                {idea.tags.map((t) => (
                  <Link key={t} to={page.tagHref(t)} style={{ textDecoration: 'none' }}>
                    <Tag name={t} onClick={() => {}} />
                  </Link>
                ))}
                {showSuggestions && (
                  <TagSuggestions suggestions={page.suggestions} onAdd={page.addSuggestedTag} onDismiss={page.dismissSuggestedTag} busy={page.suggestionBusy} />
                )}
              </div>
            )}

            {idea.notes && (
              <p style={{ margin: 0, fontSize: 'var(--text-body-md)', lineHeight: 'var(--leading-relaxed)', color: 'var(--nug-ink-700)', whiteSpace: 'pre-wrap', textWrap: 'pretty' }}>
                {idea.notes}
              </p>
            )}

            <FeatureRequests requests={page.requests} onRetry={page.retryRequest} retrying={page.retrying} />

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
      )}

      {idea && <PlanWithClaude open={page.planning} idea={idea} onClose={page.closePlan} onSave={page.savePlan} />}

      <Dialog
        open={page.purging}
        width={430}
        title="Purge this nugget?"
        description="It's gone for good — restoring won't be an option."
        onClose={page.cancelPurge}
        footer={
          <>
            <Button variant="ghost" onClick={page.cancelPurge}>
              Keep it
            </Button>
            <Button variant="danger" onClick={page.confirmPurge}>
              Purge
            </Button>
          </>
        }
      />
    </>
  );
}
