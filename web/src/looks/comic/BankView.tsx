import './bank.css';
import { TopBar } from '../../components/navigation/TopBar';
import { IdeaForm } from '../../components/nuggets/IdeaForm';
import { SettingsButton } from '../../components/settings/SettingsButton';
import { STATUSES } from '../../api';
import { statusLabel } from '../../lib/status';
import type { Bank } from '../../models/useBank';
import { NuggetCard } from './NuggetCard';
import { RandomNugget } from './RandomNugget';
import { ActionError, Button, Chip, EmptyState, Icon, IconButton, SearchField } from './ui';

/**
 * The bank in the Comic look: a tray of lumpy, ink-lined nugget cards on a
 * gingham liner, with the status and tag filters above it. Everything it
 * draws comes from the `bank` model (ADR 0002), the same one Classic's
 * BankView takes, with the same labels and accessible names, so the route's
 * tests pass under both Looks. The edit and drop dialogs are still Classic's
 * IdeaForm, and Settings is still Classic's button (#54, #55).
 */
export function BankView({ bank }: { bank: Bank }) {
  const filtered = !!(bank.query || bank.activeTag || bank.activeStatus);
  return (
    <>
      <TopBar
        center={<SearchField value={bank.query} placeholder="Search your nuggets…" onChange={(e) => bank.setQuery(e.target.value)} onClear={() => bank.setQuery('')} />}
        right={
          <>
            <RandomNugget tag={bank.activeTag} onDraw={bank.draw} loading={bank.drawLoading} />
            <SettingsButton />
            <Button size="sm" icon="trash" onClick={bank.openTrash}>
              Trash
            </Button>
            <Button variant="tomato" icon="plus" onClick={bank.openCreate}>
              Drop a nugget
            </Button>
          </>
        }
      />

      <main className="comic-bank">
        <ActionError message={bank.actionError} onDismiss={bank.dismissActionError} />

        <div className="comic-filters">
          <div role="group" aria-label="Filter by status" className="comic-filter-row">
            <Chip pressed={bank.activeStatus === null} onClick={() => bank.setActiveStatus(null)}>
              All
            </Chip>
            {STATUSES.map((s) => (
              <Chip key={s} pressed={bank.activeStatus === s} onClick={() => bank.setActiveStatus(bank.activeStatus === s ? null : s)}>
                {statusLabel(s)}
              </Chip>
            ))}
          </div>
          {bank.tags.length > 0 && (
            <div role="group" aria-label="Filter by tag" className="comic-filter-row">
              <Chip pressed={bank.activeTag === null} onClick={() => bank.setActiveTag(null)}>
                All
              </Chip>
              {bank.tags.map((t) => (
                <Chip key={t.name} pressed={bank.activeTag === t.name} onClick={() => bank.setActiveTag(bank.activeTag === t.name ? null : t.name)}>
                  #{t.name}
                </Chip>
              ))}
            </div>
          )}
        </div>

        <p className="comic-tray-label">The bank · {bank.nuggets.length} on the tray</p>
        <section className="comic-tray" aria-label="The tray">
          <div className="comic-liner">
            {bank.nuggets.length === 0 ? (
              <EmptyState
                eyebrow="Meanwhile, on the tray…"
                headline={filtered ? 'No nuggets match' : 'Nothing in the bank yet'}
                body={filtered ? 'Try a different word, or clear the filters.' : 'Drop your first nugget in. Half-formed is fine.'}
                action={
                  <Button variant="tomato" size="sm" icon="plus" onClick={bank.openCreate}>
                    Drop a nugget
                  </Button>
                }
              />
            ) : (
              <ul className="comic-tray-grid">
                {bank.nuggets.map((n) => (
                  <li key={n.id} className="comic-tray-item">
                    <NuggetCard id={n.id} title={n.title} status={n.status} age={n.date} tags={n.tags} projectName={n.projectName || undefined} onOpen={() => bank.openNugget(n.id)} />
                    <div className="comic-tray-actions">
                      <IconButton label="Edit" onClick={() => bank.openEdit(n.id)}>
                        <Icon name="pencil" size={16} />
                      </IconButton>
                      <IconButton label="Archive" onClick={() => bank.archive(n.id)}>
                        <Icon name="archive" size={16} />
                      </IconButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>

      <IdeaForm
        open={bank.creating}
        mode="create"
        tagOptions={bank.tags.map((t) => t.name)}
        onSubmit={bank.submitCreate}
        onClose={bank.closeCreate}
        error={bank.formError}
      />

      {bank.editing && (
        <IdeaForm
          open
          mode="edit"
          idea={bank.editing}
          tagOptions={bank.tags.map((t) => t.name)}
          onSubmit={bank.submitEdit}
          onClose={bank.closeEdit}
          error={bank.formError}
        />
      )}
    </>
  );
}

// React.lazy takes the default export; the route loads this module on demand so
// the Comic bank stays out of the entry bundle.
export default BankView;
