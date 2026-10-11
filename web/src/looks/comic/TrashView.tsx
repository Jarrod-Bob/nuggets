import './bin.css';
import { TopBar } from '../../components/navigation/TopBar';
import type { Trash } from '../../models/useTrash';
import { BinCard } from './BinCard';
import { SettingsButton } from './settings/SettingsButton';
import { ActionError, Button, CaptionBox, Dialog, EmptyState } from './ui';

/**
 * The bin in the Comic look: binned nuggets, newest first, as greyed cards
 * under a caption that says what Restore and Purge do. Everything it draws
 * comes from the `trash` model (ADR 0002), the same one Classic's TrashView
 * takes, with the same labels and accessible names.
 */
export function TrashView({ trash }: { trash: Trash }) {
  return (
    <>
      <TopBar
        center={<h1 className="comic-bin-heading">Trash</h1>}
        right={
          <>
            <SettingsButton />
            <Button size="sm" icon="arrow-left" onClick={trash.backToBank}>
              Back to the bank
            </Button>
          </>
        }
      />

      <main className="comic-bin">
        <ActionError message={trash.actionError} onDismiss={trash.dismissActionError} />
        {trash.nuggets.length === 0 ? (
          <EmptyState eyebrow="Meanwhile, in the bin…" headline="Trash is empty" body="Archived nuggets land here. Nothing has been binned yet." />
        ) : (
          <>
            <CaptionBox tone="mayo" eyebrow="Meanwhile, in the bin…" className="comic-bin-note">
              Archived nuggets, newest binned first. Restoring puts one back in the bank; purging is permanent.
            </CaptionBox>
            <ul className="comic-bin-grid">
              {trash.nuggets.map((n) => (
                <BinCard key={n.id} id={n.id} title={n.title} tags={n.tags} archivedAt={n.archivedAt} onRestore={() => trash.restore(n.id)} onPurge={() => trash.askPurge(n.id)} />
              ))}
            </ul>
          </>
        )}
      </main>

      {trash.purgeTarget && (
        <Dialog
          width={430}
          title="Purge this nugget?"
          description="It's gone for good — restoring won't be an option."
          onClose={trash.cancelPurge}
          footer={
            <>
              <Button onClick={trash.cancelPurge}>Keep it</Button>
              <Button variant="danger" onClick={trash.confirmPurge}>
                Purge
              </Button>
            </>
          }
        />
      )}
    </>
  );
}

// React.lazy takes the default export; the route loads this module on demand so
// the Comic bin stays out of the entry bundle.
export default TrashView;
