import React from 'react';

/**
 * A nugget's project name as shown under its title, on cards and the nugget
 * page. The title stays the headline; this line only appears when there is a
 * project name.
 */
export function ProjectNameLine({ name, style }: { name: string; style?: React.CSSProperties }) {
  return (
    <p style={{ margin: 0, fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-500)', ...style }}>
      Suggested project name: {name}
    </p>
  );
}
