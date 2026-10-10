import { TopBar } from '../../components/navigation/TopBar';
import { Button } from '../../components/core/Button';
import { Dialog } from '../../components/feedback/Dialog';
import { EmptyState } from '../../components/feedback/EmptyState';
import { IdeaCard } from '../../components/nuggets/IdeaCard';
import { SettingsButton } from '../../components/settings/SettingsButton';
import { Main } from '../../components/Shell';
import { ActionError } from '../../components/feedback/ActionError';
import { iconArrowLeft } from '../../components/icons';
import type { Trash } from '../../models/useTrash';

/** The trash in the Classic look: its own address, never mixed into the bank's list. */
export function TrashView({ trash }: { trash: Trash }) {
  return (
    <>
      <TopBar
        center={<span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-title-3)' }}>Trash</span>}
        right={
          <>
            <SettingsButton />
            <Button variant="ghost" size="sm" onClick={trash.backToBank} iconLeft={iconArrowLeft}>
              Back to the bank
            </Button>
          </>
        }
      />

      <Main>
        <ActionError message={trash.actionError} onDismiss={trash.dismissActionError} />
        {trash.nuggets.length === 0 ? (
          <EmptyState variant="bucket" headline="Trash is empty" body="Archived nuggets land here. Nothing has been binned yet." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-500)' }}>
              Archived nuggets, newest binned first. Restoring puts one back in the bank; purging is permanent.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
              {trash.nuggets.map(i => (
                <IdeaCard key={i.id} archived title={i.title} notes={i.notes} tags={i.tags} date={i.archivedAt}
                  actions={<>
                    <Button size="sm" variant="secondary" onClick={() => trash.restore(i.id)}>Restore</Button>
                    <Button size="sm" variant="danger" onClick={() => trash.askPurge(i.id)}>Purge</Button>
                  </>} />
              ))}
            </div>
          </div>
        )}
      </Main>

      <Dialog
        open={!!trash.purgeTarget}
        width={430}
        title="Purge this nugget?"
        description="It's gone for good — restoring won't be an option."
        onClose={trash.cancelPurge}
        footer={
          <>
            <Button variant="ghost" onClick={trash.cancelPurge}>
              Keep it
            </Button>
            <Button variant="danger" onClick={trash.confirmPurge}>
              Purge
            </Button>
          </>
        }
      />
    </>
  );
}
