import React from 'react';
import type { Status } from '../../api';
import { statusLabel } from '../../lib/status';
import { CurryCorner } from './CurryCorner';
import { CardArt, shapeSeed } from './ui';

/** Resting rotations, picked by the nugget's id so a card never changes its tilt between visits. */
const TILTS = [-3, 2, -2, 3, -1, 4, -4, 1];

/** A nugget on the tray: a lumpy outline holding its status, age, title and tags. */
export interface NuggetCardProps {
  id: number | string;
  title: string;
  status: Status;
  /** Short age, e.g. "2d ago" (the " ago" is dropped), or "just now". */
  age?: string;
  /** Tag names without the hash. */
  tags?: string[];
  /** The nugget's project name. Set, the card wears the curry corner; unset, no sauce. */
  projectName?: string;
  onOpen?: () => void;
}

/**
 * The card is a button that opens the nugget; the curry corner (named nuggets
 * only) is a separate button on top of it. A named card shows "status · age"
 * in its meta line, since the corner takes the spot where the age would sit.
 * Controls that act on the nugget (edit, archive) go beside the card, not in it.
 */
export function NuggetCard({ id, title, status, age, tags = [], projectName, onOpen }: NuggetCardProps) {
  const seed = shapeSeed(id, title.length);
  const tilt = TILTS[seed % TILTS.length];
  const shortAge = age?.replace(/ ago$/, '');
  const named = !!projectName;
  return (
    <div className={['comic-card', `comic-card--${status}`, named && 'comic-card--named'].filter(Boolean).join(' ')} style={{ '--comic-tilt': `${tilt}deg` } as React.CSSProperties}>
      <CardArt shape={seed} status={status} />
      <button type="button" className="comic-card-open" onClick={onOpen}>
        <span className="comic-card-body">
          <span className="comic-card-meta">
            {named ? (
              <b>{[statusLabel(status), shortAge].filter(Boolean).join(' · ')}</b>
            ) : (
              <>
                <b>{statusLabel(status)}</b>
                <span>{shortAge}</span>
              </>
            )}
          </span>
          <span className="comic-card-title">{title}</span>
          {tags.length > 0 && <span className="comic-card-tags">{tags.map((t) => `#${t.toLowerCase()}`).join(' ')}</span>}
        </span>
      </button>
      {named && <CurryCorner projectName={projectName} title={title} shape={seed} status={status} />}
    </div>
  );
}
