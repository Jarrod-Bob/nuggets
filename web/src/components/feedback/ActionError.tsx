/**
 * The inline error banner each route shows for a failed action. Errors render in
 * the affected screen, not in a toast — the app deliberately has no toast system
 * (MVP design §8). Per-route, dismissable.
 */
export function ActionError({ message, onDismiss }: { message?: string; onDismiss: () => void }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      style={{
        marginBottom: 16,
        padding: '10px 14px',
        borderRadius: 'var(--radius-md, 8px)',
        background: 'var(--nug-red-50, #fef2f2)',
        color: 'var(--nug-red-700, #b91c1c)',
        fontSize: 'var(--text-small, 13px)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 600 }}
      >
        Dismiss
      </button>
    </div>
  );
}
