import React from 'react';

export interface SettingsSectionProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

/** One titled block of the settings dialog — Telegram, spices — divided from the next by a hairline. */
export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <section style={{ padding: '18px 0', borderTop: 'var(--border-hairline, 1px) solid var(--nug-ink-200)' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 'var(--text-title-3, 18px)', fontWeight: 'var(--weight-bold)' }}>{title}</h3>
      {description && (
        <p style={{ margin: '0 0 14px', fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-700)', textWrap: 'pretty' }}>{description}</p>
      )}
      {children}
    </section>
  );
}
