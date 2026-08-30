import * as React from 'react';

export interface RandomIdea { title: string; notes?: string; tags?: string[] }

/**
 * The mini-challenge: one button, one result dialog, reroll freely.
 * Backed by `GET /api/ideas/random?tag=`, which is stateless — nothing is
 * recorded and archived ideas are always excluded. Optionally narrowed to the
 * currently-filtered tag.
 */
export interface RandomNuggetProps {
  /** Narrow the draw to this tag; `null` draws from everything active. */
  tag?: string | null;
  /** Called on open and on each reroll; return the drawn idea, or null for none. */
  onDraw?: (tag: string | null) => RandomIdea | null;
  buttonLabel?: string;
  buttonVariant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  style?: React.CSSProperties;
}
export declare function RandomNugget(props: RandomNuggetProps): JSX.Element;
