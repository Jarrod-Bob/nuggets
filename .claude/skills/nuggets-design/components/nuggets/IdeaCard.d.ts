import * as React from 'react';

/**
 * One idea in the bank, as a full-width row in the newest-first list.
 * Maps to the `ideas` row: title, notes, its tags, and `created_at`.
 *
 * The corner radius is **fluid by default**: eight corner values derived from a
 * hash of the title, so every nugget is a slightly different soft shape — the
 * way no two real nuggets match — while staying a legible rectangle. It is
 * deterministic, so a card never changes shape between renders.
 */
export interface IdeaCardProps {
  /** `ideas.title` — required and non-empty. Also seeds the fluid shape. */
  title: string;
  /** `ideas.notes` — may be empty. Clamped to two lines. */
  notes?: string;
  /** Normalised lowercase tag names. */
  tags?: string[];
  /** Short relative date, rendered in mono. */
  date?: string;
  /** Renders the archived treatment (cream fill, dimmed) for the trash view. */
  archived?: boolean;
  /** `fluid` varies the corners per nugget; `soft` pins every card to --radius-lg. */
  shape?: 'fluid' | 'soft';
  /** Takes a chomp out of the top-right corner. Reserve it for ideas that have been acted on. */
  bitten?: boolean;
  /** Colour filling the bite — must match whatever the card sits on. */
  biteBackground?: string;
  /** Override the shape seed (use the stable `ideas.id` if titles can be edited). */
  seed?: string;
  onClick?: () => void;
  /** Trailing controls — edit / archive, or restore / purge in the trash. */
  actions?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function IdeaCard(props: IdeaCardProps): JSX.Element;
/** Eight-value `border-radius` string derived from a seed. Exported for reuse on other nugget-shaped surfaces. */
export declare function fluidRadius(seed: string, min?: number, max?: number): string;
