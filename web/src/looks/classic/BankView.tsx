import { TopBar } from '../../components/navigation/TopBar';
import { SearchField } from '../../components/forms/SearchField';
import { Button } from '../../components/core/Button';
import { IconButton } from '../../components/core/IconButton';
import { IdeaList } from '../../components/nuggets/IdeaList';
import { IdeaForm } from '../../components/nuggets/IdeaForm';
import { RandomNugget } from '../../components/nuggets/RandomNugget';
import { SettingsButton } from '../../components/settings/SettingsButton';
import { Main } from '../../components/Shell';
import { ActionError } from '../../components/feedback/ActionError';
import { iconPlus, iconTrash, iconPencil, iconArchive } from '../../components/icons';
import type { Bank } from '../../models/useBank';

/** The bank in the Classic look. */
export function BankView({ bank }: { bank: Bank }) {
  return (
    <>
      <TopBar
        center={<SearchField value={bank.query} onChange={(e) => bank.setQuery(e.target.value)} onClear={() => bank.setQuery('')} style={{ width: 340 }} />}
        right={
          <>
            <RandomNugget tag={bank.activeTag} onDraw={bank.draw} loading={bank.drawLoading} />
            <SettingsButton />
            <Button variant="ghost" size="sm" onClick={bank.openTrash} iconLeft={iconTrash}>
              Trash
            </Button>
            <Button onClick={bank.openCreate} iconLeft={iconPlus}>
              Drop a nugget
            </Button>
          </>
        }
      />

      <Main>
        <ActionError message={bank.actionError} onDismiss={bank.dismissActionError} />
        <IdeaList
          ideas={bank.items}
          tags={bank.tags}
          query={bank.query}
          showSearch={false}
          activeTag={bank.activeTag}
          activeStatus={bank.activeStatus}
          onTagChange={bank.setActiveTag}
          onStatusChange={bank.setActiveStatus}
          onOpen={(item) => bank.openNugget(Number(item.id))}
          rowActions={(item) => (
            <span style={{ display: 'flex', gap: 2 }} onClick={(e) => e.stopPropagation()}>
              <IconButton label="Edit" onClick={() => bank.openEdit(Number(item.id))}>
                {iconPencil}
              </IconButton>
              <IconButton label="Archive" onClick={() => bank.archive(Number(item.id))}>
                {iconArchive}
              </IconButton>
            </span>
          )}
          emptyAction={<Button onClick={bank.openCreate}>Drop a nugget</Button>}
        />
      </Main>

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
