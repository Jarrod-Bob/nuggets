import React from 'react';
import { m } from 'motion/react';
import type { Constraint, Rng } from '../../lib/challenge';
import { CATALOG_SOURCE, TRACK_LABELS, type TimeboxPreset } from '../../lib/challengeCatalog';
import { dur, ease } from '../../lib/motion';
import { useRandomDraw, type RandomIdea } from '../../models/useRandomDraw';
import { Button, CaptionBox, CardArt, Dialog, shapeSeed } from './ui';

const DRAW_TILT = [-5, 4, -3, 5];

/**
 * The drawn nugget: its card dropped onto the dialog at a tilt (a bounce, the
 * house easing) and a red-ink PICK ME rubber stamp thumped on its corner once
 * it lands. The stamp is display type, not a sound effect, and hidden from
 * assistive tech. Keyed by the nugget, so a reroll drops a fresh card. Under
 * reduced motion (MotionConfig) the card is simply there with its stamp.
 */
function DrawnCard({ idea, tag }: { idea: RandomIdea; tag: string | null }) {
  const seed = shapeSeed(idea.id, 0);
  const tilt = DRAW_TILT[seed % DRAW_TILT.length];
  const tags = (idea.tags ?? []).map((t) => `#${t.toLowerCase()}`).join(' ');
  return (
    <m.div
      className="comic-drawn"
      initial={{ opacity: 0, y: -160, rotate: tilt - 24 }}
      animate={{ opacity: 1, y: 0, rotate: tilt }}
      transition={{ duration: dur.lazy + dur.base, ease: ease.bounce }}
    >
      <CardArt shape={seed} status={idea.status ?? 'building'} />
      <div className="comic-card-body">
        {tag && (
          <span className="comic-card-meta">
            <b>narrowed to {tag}</b>
          </span>
        )}
        <h3 className="comic-card-title">{idea.title}</h3>
        {tags && <span className="comic-card-tags">{tags}</span>}
      </div>
      <m.span
        className="comic-stamp"
        aria-hidden="true"
        initial={{ opacity: 0, scale: 1.8, rotate: 14 }}
        animate={{ opacity: 1, scale: 1, rotate: 14 }}
        transition={{ duration: dur.base + dur.fast, ease: ease.bounce, delay: 0.5 }}
      >
        PICK ME
      </m.span>
    </m.div>
  );
}

function ChallengeRow({ label, rerollLabel, onReroll, children }: { label: string; rerollLabel: string; onReroll: () => void; children: React.ReactNode }) {
  return (
    <div className="comic-challenge-row">
      <div className="comic-challenge-text">
        <span className="comic-challenge-label">{label}</span>
        <span className="comic-challenge-value">{children}</span>
      </div>
      <Button size="sm" onClick={onReroll}>
        {rerollLabel}
      </Button>
    </div>
  );
}

function Challenge({ timebox, constraint, onRerollTimebox, onRerollConstraint }: { timebox: TimeboxPreset; constraint: Constraint; onRerollTimebox: () => void; onRerollConstraint: () => void }) {
  return (
    <div className="comic-challenge">
      <ChallengeRow label="Timebox" rerollLabel="Reroll timebox" onReroll={onRerollTimebox}>
        <span data-testid="challenge-timebox">{timebox.label}</span>
      </ChallengeRow>
      <ChallengeRow label="Build it with" rerollLabel="Reroll stack" onReroll={onRerollConstraint}>
        <span data-testid="challenge-stack">
          {constraint.language} + {constraint.framework}
        </span>
        <span className="comic-challenge-track">{TRACK_LABELS[constraint.track]}</span>
      </ChallengeRow>
      <a className="comic-challenge-source" href={CATALOG_SOURCE.url} target="_blank" rel="noreferrer" title={`Popularity weights copied ${CATALOG_SOURCE.retrieved}`}>
        data: {CATALOG_SOURCE.label}
      </a>
    </div>
  );
}

export interface RandomNuggetProps {
  /** Narrow the draw to this tag; `null` draws from everything active. */
  tag?: string | null;
  /** Called on open and on each reroll; return the drawn idea, or null for none. */
  onDraw?: (tag: string | null) => RandomIdea | null;
  /** True while the caller's draw source hasn't resolved yet; the dialog says "Drawing…" instead of "Nothing to draw". */
  loading?: boolean;
  /** Randomness for the challenge; tests inject a fixed one. */
  rng?: Rng;
}

/**
 * Draw a nugget in the Comic look: the button, and its result dialog with the
 * drawn card, its notes and the dealt challenge. Driven by `useRandomDraw`,
 * the same model Classic uses, with the same labels.
 */
export function RandomNugget({ tag = null, onDraw, loading = false, rng = Math.random }: RandomNuggetProps) {
  const draw = useRandomDraw({ tag, onDraw, rng });
  const { open, idea, timebox, constraint } = draw;
  return (
    <>
      <Button icon="dice" onClick={draw.openFresh} disabled={loading}>
        Draw a nugget
      </Button>
      {open && (
        <Dialog
          width={480}
          onClose={draw.close}
          title={loading ? 'Drawing…' : idea ? 'Your challenge' : 'Nothing to draw'}
          footer={
            <>
              <Button onClick={draw.close}>Close</Button>
              <Button variant="tomato" onClick={draw.rerollNugget} disabled={loading}>
                Reroll nugget
              </Button>
            </>
          }
        >
          {loading ? (
            <p role="status" className="comic-random-wait">
              Drawing a nugget…
            </p>
          ) : idea ? (
            <>
              <DrawnCard key={idea.id ?? idea.title} idea={idea} tag={tag} />
              {idea.notes && <p className="comic-random-notes">{idea.notes}</p>}
              {timebox && constraint && <Challenge timebox={timebox} constraint={constraint} onRerollTimebox={draw.rerollTimebox} onRerollConstraint={draw.rerollConstraint} />}
            </>
          ) : (
            <CaptionBox eyebrow="Meanwhile, on the tray…">No active nuggets match that tag. Drop one in first.</CaptionBox>
          )}
        </Dialog>
      )}
    </>
  );
}
