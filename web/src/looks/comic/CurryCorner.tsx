import React from 'react';
import type { Status } from '../../api';
import { useSauce } from '../../models/useSauce';
import { blob } from './ui/blob';
import { CARD_BOX, cardShape, outlineDash } from './ui/cardGeometry';

const DAB = blob(350, 12, 128, 104, 11, 22, 0.07);
const FLOOD = blob(250, 90, 420, 320, 37, 30, 0.04);

/** A curry drip: a stem open at the top (so it merges with the sauce above it), a round tip, a gloss line and an optional hanging drop. */
function Drip({ x, y0, len, w, drop }: { x: number; y0: number; len: number; w: number; drop: number }) {
  const b = y0 + len;
  return (
    <g>
      <path d={`M${x - w} ${y0}V${b}A${w} ${w} 0 0 0 ${x + w} ${b}V${y0}Z`} fill="var(--comic-curry)" />
      <path d={`M${x - w} ${y0 + 6}V${b}A${w} ${w} 0 0 0 ${x + w} ${b}V${y0 + 6}`} stroke="var(--comic-ink)" strokeWidth={3} strokeLinecap="round" fill="none" />
      <path d={`M${x - w / 2.4} ${b - 4}v-${Math.max(4, Math.round(len * 0.35))}`} stroke="var(--comic-curry-gloss)" strokeWidth={2.5} strokeLinecap="round" />
      {drop ? <ellipse cx={x} cy={b + w + drop} rx={w * 0.7} ry={w * 0.95} fill="var(--comic-curry)" stroke="var(--comic-ink)" strokeWidth={3} /> : null}
    </g>
  );
}

/**
 * The curry corner of a named nugget's card (the design's NuggetCard sauce).
 * One dab on the top-right corner means "this nugget has a project name". The
 * dab is its own button: a mouse hovering it previews the sauce flooding the
 * card to show the name; a click, tap or Enter pins it; a second press or
 * Escape drains it. The state is `useSauce`, shared with Classic. Clicks on the
 * dab stop there; clicks on the flood fall through to the card behind it.
 *
 * Its layers stack inside a positioned card (see `.comic-card`): the dab under
 * the card's text, the flood and the name over it, the button on top. The
 * flood's text is aria-hidden: the button's label carries the name whether or
 * not the sauce is showing. Reduced motion is the stylesheet's job (the pour
 * becomes a fade).
 */
export function CurryCorner({ projectName, title, shape, status }: { projectName: string; title: string; shape: number; status: Status }) {
  const sauce = useSauce();
  const d = cardShape(shape);
  const clip = 'comic-clip-' + React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const dash = outlineDash(status);
  return (
    <>
      <svg className="comic-curry-dab" viewBox={CARD_BOX} aria-hidden="true">
        <defs>
          <clipPath id={clip}>
            <path d={d} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <path d={DAB} fill="var(--comic-curry)" stroke="var(--comic-ink)" strokeWidth={3.5} />
          <path d="M282 34c14-8 34-8 48 2" stroke="var(--comic-curry-gloss)" strokeWidth={5} strokeLinecap="round" fill="none" />
        </g>
        <path d={d} stroke="var(--comic-ink)" strokeWidth={3.5} strokeLinejoin="round" fill="none" strokeDasharray={dash} />
        <Drip x={262} y0={60} len={62} w={9} drop={7} />
        <Drip x={318} y0={70} len={62} w={7} drop={0} />
      </svg>
      <svg className="comic-curry-flood" data-open={sauce.open} viewBox={CARD_BOX} aria-hidden="true">
        <g clipPath={`url(#${clip})`}>
          <path d={FLOOD} fill="var(--comic-curry)" />
          <path d="M120 52c40-18 100-20 150-6M60 150c10-20 24-32 40-38" stroke="var(--comic-curry-gloss)" strokeWidth={5} strokeLinecap="round" fill="none" />
        </g>
        <path d={d} stroke="var(--comic-ink)" strokeWidth={3.5} strokeLinejoin="round" fill="none" />
        <g className="comic-curry-drips">
          <Drip x={150} y0={228} len={34} w={9} drop={8} />
          <Drip x={209} y0={226} len={20} w={8} drop={0} />
          <Drip x={266} y0={216} len={44} w={10} drop={0} />
        </g>
      </svg>
      <span className="comic-curry-name" data-open={sauce.open} aria-hidden="true">
        <span className="comic-curry-label">Project name</span>
        <span className={projectName.length > 14 ? 'comic-curry-text comic-curry-text--long' : 'comic-curry-text'}>{projectName}</span>
        <span className="comic-curry-title">{title}</span>
      </span>
      <button
        type="button"
        className="comic-curry-btn"
        aria-label={`Project name: ${projectName}`}
        aria-expanded={sauce.open}
        title="Project name"
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') sauce.hoverStart();
        }}
        onPointerLeave={sauce.hoverEnd}
        onClick={(e) => {
          e.stopPropagation();
          sauce.press();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && sauce.escape()) e.stopPropagation();
        }}
      />
    </>
  );
}
