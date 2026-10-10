import React from 'react';
import { ActionError, CaptionBox, StatePill, type StatePillProps } from '../ui';

export interface SettingsSectionProps {
  title: string;
  description: string;
  /** The connection's state, as a pill. Leave out for a section with none (kimi). */
  status?: { tone: StatePillProps['tone']; label: string };
  /** Mono facts on the right of the status line ("every 60s · synced 2 min ago"). */
  detail?: React.ReactNode;
  /** The literal error, as an ActionError without Dismiss. */
  error?: string;
  /** Fields and notes. */
  children?: React.ReactNode;
  /** "Disconnect", on the left. */
  dangerAction?: React.ReactNode;
  /** The rest on the right, the commit last. All paper: four sections would make four primaries. */
  actions?: React.ReactNode;
}

/**
 * One integration in the Comic Settings dialog (the design's SettingsSection):
 * a mayo caption-box heading, a status line, the error, the fields, and the
 * pills. Presentational: the section components feed it from their models.
 */
export function SettingsSection({ title, description, status, detail, error, children, dangerAction, actions }: SettingsSectionProps) {
  const titleId = React.useId();
  return (
    <section className="comic-settings" aria-labelledby={titleId}>
      <CaptionBox tone="mayo">
        <h3 id={titleId} className="comic-settings-title">
          {title}
        </h3>
        <p className="comic-settings-desc">{description}</p>
      </CaptionBox>
      {(status || detail) && (
        <div className="comic-settings-status">
          {status && <StatePill tone={status.tone}>{status.label}</StatePill>}
          {detail && <span className="comic-settings-detail">{detail}</span>}
        </div>
      )}
      <ActionError message={error} />
      {children}
      {(dangerAction || actions) && (
        <div className="comic-settings-actions">
          {dangerAction || <span />}
          <div className="comic-settings-actions-end">{actions}</div>
        </div>
      )}
    </section>
  );
}
