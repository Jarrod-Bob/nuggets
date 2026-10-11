import React from 'react';
import { drawConstraint, drawTimebox, type Constraint, type Rng } from '../lib/challenge';
import type { TimeboxPreset } from '../lib/challengeCatalog';
import type { Status } from '../api';

export interface RandomIdea { id?: number; title: string; notes?: string; tags?: string[]; status?: Status }

/**
 * The Draw-a-nugget challenge, shared by every look (ADR 0002): opening deals
 * a nugget, a timebox and a language + framework constraint, and each rerolls
 * on its own. Rerolling the nugget keeps the challenge. Nothing is saved.
 */
export interface RandomDraw {
  open: boolean;
  /** The drawn nugget, or null when nothing matched. */
  idea: RandomIdea | null;
  timebox: TimeboxPreset | null;
  constraint: Constraint | null;
  /** Deal a whole new challenge and show it. */
  openFresh: () => void;
  close: () => void;
  rerollNugget: () => void;
  rerollTimebox: () => void;
  rerollConstraint: () => void;
}

export function useRandomDraw({
  tag,
  onDraw,
  rng,
}: {
  tag: string | null;
  /** Called on open and on each nugget reroll; returns the drawn idea, or null for none. */
  onDraw?: (tag: string | null) => RandomIdea | null;
  rng: Rng;
}): RandomDraw {
  const [open, setOpen] = React.useState(false);
  const [idea, setIdea] = React.useState<RandomIdea | null>(null);
  const [timebox, setTimebox] = React.useState<TimeboxPreset | null>(null);
  const [constraint, setConstraint] = React.useState<Constraint | null>(null);
  const draw = () => {
    setIdea(onDraw ? onDraw(tag) : null);
    setOpen(true);
  };
  return {
    open,
    idea,
    timebox,
    constraint,
    openFresh: () => {
      setTimebox(drawTimebox(rng));
      setConstraint(drawConstraint(rng));
      draw();
    },
    close: () => setOpen(false),
    rerollNugget: draw,
    rerollTimebox: () => setTimebox(drawTimebox(rng, timebox)),
    rerollConstraint: () => setConstraint(drawConstraint(rng, constraint)),
  };
}
