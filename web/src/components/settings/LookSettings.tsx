import { SettingsSection } from './SettingsSection';
import { useLookSetting } from '../../models/useLookSetting';
import type { Look } from '../../looks/look';

export interface LookSettingsProps {
  /** Whether the settings dialog is showing: the saved look is fetched each time it opens. */
  open: boolean;
}

const OPTIONS: ReadonlyArray<{ look: Look; label: string }> = [
  { look: 'classic', label: 'Classic' },
  { look: 'comic', label: 'Comic (in progress)' },
];

/**
 * The Look section of the settings dialog (ADR 0002): Classic, or Comic while
 * it is being drawn. Choosing one saves it and switches the page at once.
 */
export function LookSettings({ open }: LookSettingsProps) {
  const { look, choose, error, busy } = useLookSetting(open);

  return (
    <SettingsSection title="Look" description="How nuggets looks. Comic is still being drawn, so most of it still shows Classic.">
      {error && (
        <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--nug-ketchup-100)', color: 'var(--nug-ketchup-600)', fontSize: 'var(--text-body-sm)' }}>
          {error}
        </div>
      )}
      <div role="radiogroup" aria-label="Look" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {OPTIONS.map((option) => (
          <label key={option.look} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-body-sm)' }}>
            <input type="radio" name="nug-look" checked={look === option.look} disabled={look === undefined || busy}
              onChange={() => choose(option.look)} />
            {option.label}
          </label>
        ))}
      </div>
    </SettingsSection>
  );
}
