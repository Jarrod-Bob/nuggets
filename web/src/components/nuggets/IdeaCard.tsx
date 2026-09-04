import React from 'react';
import { Tag } from '../core/Tag';
import { Badge } from '../core/Badge';
import type { Status } from '../../api';
import { statusLabel, statusTone, isActedOn } from '../../lib/status';
import { fluidRadius } from './fluidRadius';

export { fluidRadius } from './fluidRadius';

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
  /** Lifecycle status — rendered as a Badge, and drives the bitten treatment. */
  status?: Status;
  /** How many links the nugget carries — shown as a small count. */
  linkCount?: number;
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

function truncate(s = '', max = 40): string {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

/** Keeps at most `count` sentences, then tapers into trailing dots instead of a hard cut. */
function clampSentences(s = '', count = 2): string {
  const parts = s.match(/[^.!?]+[.!?]*/g) || [s];
  if (parts.length <= count) return s;
  return parts.slice(0, count).join('').trimEnd().replace(/[.!?]*$/, '') + '…';
}

function Bite({ background, border }: { background: string; border: string }) {
  // A single round chomp taken clean out of the top-right corner, plus two
  // crumbs that fell off — reads as a bite, not an edge scallop.
  return (
    <svg width="76" height="76" viewBox="-12 -12 76 76" aria-hidden="true"
      style={{ position: 'absolute', top: -12, right: -12, pointerEvents: 'none' }}>
      <circle cx="52" cy="0" r="28" fill={background} />
      <path d="M24,0 A28,28 0 0,1 52,28" fill="none" stroke={border} strokeWidth="2" strokeLinecap="round" />
      <circle cx="64" cy="24" r="3.2" fill={border} opacity="0.55" />
      <circle cx="36" cy="-12" r="2.2" fill={border} opacity="0.45" />
    </svg>
  );
}

export function IdeaCard({ title, notes, tags = [], status, linkCount = 0, date, archived = false, shape = 'fluid', bitten, biteBackground = 'var(--surface-page)', seed, onClick, actions, style }: IdeaCardProps) {
  const [hover, setHover] = React.useState(false);
  const radius = shape === 'fluid' ? fluidRadius(seed || title || '') : 'var(--radius-lg)';
  // Anything past raw is "acted on" — that is what the bite was reserved for.
  // An explicit bitten prop still wins when the caller sets one.
  const isBitten = bitten ?? (status ? isActedOn(status) : false);
  return (
    <article onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 18px',
        background: archived ? 'var(--nug-cream-50)' : 'var(--surface-card)',
        border: 'var(--border-regular) solid var(--nug-ink-200)', borderRadius: radius,
        boxShadow: hover && onClick ? 'var(--shadow-2)' : 'var(--shadow-1)',
        transform: hover && onClick ? 'translateY(-2px) rotate(-0.25deg)' : 'none',
        transition: 'transform var(--dur-base) var(--ease-bounce), box-shadow var(--dur-base) var(--ease-out)',
        cursor: onClick ? 'pointer' : 'default', opacity: archived ? 0.85 : 1, ...style,
      }}>
      {isBitten && <Bite background={biteBackground} border="var(--nug-ink-200)" />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {status && (
          <div>
            <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>
          </div>
        )}
        <h3 style={{ width: '100%', fontSize: 'var(--text-title-3)', fontWeight: 'var(--weight-bold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{truncate(title, 40)}</h3>
        {notes && <p style={{ width: '100%', margin: 0, fontSize: 'var(--text-body-sm)', lineHeight: 'var(--leading-normal)', color: 'var(--nug-ink-700)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{clampSentences(notes, 2)}</p>}
        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: 6, marginTop: 1, paddingBottom: 2, scrollbarWidth: 'none' }}>
            {tags.map(t => <Tag key={t} name={t} />)}
          </div>
        )}
      </div>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 'auto', paddingTop: 2 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          {date && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--nug-ink-500)', whiteSpace: 'nowrap' }}>{date}</span>}
          {linkCount > 0 && (
            <span
              title={`${linkCount} link${linkCount === 1 ? '' : 's'}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--nug-ink-500)', whiteSpace: 'nowrap' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              {linkCount}
            </span>
          )}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>{actions}</div>
      </div>
    </article>
  );
}
