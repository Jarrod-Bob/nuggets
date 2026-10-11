import React from 'react';
import { Button, CardArt, shapeSeed } from './ui';

/** Resting rotations of a binned card: further over than the tray's, so it reads as discarded. */
const TILTS = [-6, 5, -7, 6, -5, 8, -8, 7];

export interface BinCardProps {
  id: number | string;
  title: string;
  tags?: string[];
  /** When it was binned, e.g. "2d ago". */
  archivedAt?: string;
  onRestore: () => void;
  onPurge: () => void;
}

/**
 * A binned nugget: its card greyed out and tipped over, with Restore and Purge
 * under it. It doesn't open and doesn't lift on hover. Renders an `li`.
 */
export function BinCard({ id, title, tags = [], archivedAt, onRestore, onPurge }: BinCardProps) {
  const seed = shapeSeed(id, title.length);
  return (
    <li className="comic-bin-card">
      <div className="comic-bin-shape" style={{ '--comic-tilt': `${TILTS[seed % TILTS.length]}deg` } as React.CSSProperties}>
        <CardArt shape={seed} status="raw" />
        <div className="comic-card-body">
          {archivedAt && (
            <span className="comic-card-meta">
              <b>Binned</b>
              <span>{archivedAt}</span>
            </span>
          )}
          <span className="comic-card-title">{title}</span>
          {tags.length > 0 && <span className="comic-card-tags">{tags.map((t) => `#${t.toLowerCase()}`).join(' ')}</span>}
        </div>
      </div>
      <div className="comic-bin-actions">
        <Button size="sm" onClick={onRestore}>
          Restore
        </Button>
        <Button size="sm" variant="danger" onClick={onPurge}>
          Purge
        </Button>
      </div>
    </li>
  );
}
