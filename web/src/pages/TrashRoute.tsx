import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/navigation/TopBar';
import { Button } from '../components/core/Button';
import { Dialog } from '../components/feedback/Dialog';
import { TrashView } from '../components/nuggets/TrashView';
import { Main } from '../components/Shell';
import { ActionError } from '../components/feedback/ActionError';
import { iconArrowLeft } from '../components/icons';
import { api, ApiError, type Idea } from '../api';
import { formatRelative } from '../lib/formatRelative';
import { useTags } from '../tags/TagsProvider';

const describeError = (err: unknown): string => (err instanceof ApiError ? err.message : 'Something went wrong.');

export function TrashRoute() {
  const navigate = useNavigate();
  const { refresh: refreshTags } = useTags();
  const [ideas, setIdeas] = React.useState<Idea[]>([]);
  const [actionError, setActionError] = React.useState<string | undefined>(undefined);
  const [purgeTarget, setPurgeTarget] = React.useState<Idea | null>(null);

  const refreshList = React.useCallback(() => {
    api
      .list({ archived: true })
      .then(setIdeas)
      .catch((err) => setActionError(describeError(err)));
  }, []);
  React.useEffect(() => {
    refreshList();
  }, [refreshList]);

  const restoreIdea = (id: number) => {
    api
      .restore(id)
      .then(() => {
        setActionError(undefined);
        refreshList();
        refreshTags();
      })
      .catch((err) => setActionError(describeError(err)));
  };
  const confirmPurge = () => {
    if (!purgeTarget) return;
    api
      .purge(purgeTarget.id)
      .then(() => {
        setPurgeTarget(null);
        setActionError(undefined);
        refreshList();
        refreshTags();
      })
      .catch((err) => setActionError(describeError(err)));
  };

  return (
    <>
      <TopBar
        center={<span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-title-3)' }}>Trash</span>}
        right={
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} iconLeft={iconArrowLeft}>
            Back to the bank
          </Button>
        }
      />

      <Main>
        <ActionError message={actionError} onDismiss={() => setActionError(undefined)} />
        <TrashView
          ideas={ideas.map((i) => ({
            id: i.id,
            title: i.title,
            notes: i.notes,
            tags: i.tags,
            archivedAt: i.archived_at ? formatRelative(i.archived_at) : undefined,
          }))}
          onRestore={(id) => restoreIdea(Number(id))}
          onPurge={(id) => {
            const target = ideas.find((i) => i.id === Number(id));
            if (target) setPurgeTarget(target);
          }}
        />
      </Main>

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
    </>
  );
}
