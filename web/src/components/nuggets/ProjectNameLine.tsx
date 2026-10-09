import React from 'react';

/**
 * A nugget's project name as shown under its title, on cards and the nugget
 * page: a small golden ✨ pill in DM Mono, set apart from the card's body
 * text. "Suggested project name" is its tooltip and accessible label rather
 * than visible text. The title stays the headline; the pill only appears when
 * there is a project name. Long names are cut with an ellipsis.
 */
export function ProjectNameLine({ projectName, style }: { projectName: string; style?: React.CSSProperties }) {
  return (
    <p style={{ margin: 0, fontSize: 'var(--text-body-sm)', ...style }}>
      <span role="note" aria-label={`Suggested project name: ${projectName}`} title="Suggested project name"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: '100%', boxSizing: 'border-box',
          padding: '2px 10px', borderRadius: 'var(--radius-pill)',
          background: 'var(--nug-golden-100)', border: 'var(--border-hairline) solid var(--nug-golden-400)',
          color: 'var(--nug-golden-700)', fontFamily: 'var(--font-mono)', fontWeight: 500,
        }}>
        <span aria-hidden="true">✨</span>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{projectName}</span>
      </span>
    </p>
  );
}
