import React from 'react';
import { Tag } from '../core/Tag.jsx';

function truncate(s = '', max = 40) {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

/** Keeps at most `count` sentences, then tapers into trailing dots instead of a hard cut. */
function clampSentences(s = '', count = 2) {
  const parts = s.match(/[^.!?]+[.!?]*/g) || [s];
  if (parts.length <= count) return s;
  return parts.slice(0, count).join('').trimEnd().replace(/[.!?]*$/, '') + '…';
}

// FNV-1a, same mixer as dipFor — a weak hash clusters the corners and the
// variance disappears.
function nugHash(s = '') {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/** Eight corner values in [min,max] — a soft rounded rect that is never quite the
 *  same twice, the way no two nuggets are the same shape. */
export function fluidRadius(seed = '', min = 10, max = 28) {
  let h = nugHash(seed);
  const v = [];
  for (let i = 0; i < 8; i++) { h = Math.imul(h ^ (i + 1), 0x01000193) >>> 0; v.push(min + ((h >>> 9) % (max - min + 1))); }
  return `${v[0]}px ${v[1]}px ${v[2]}px ${v[3]}px / ${v[4]}px ${v[5]}px ${v[6]}px ${v[7]}px`;
}

function Bite({ background, border }) {
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

export function IdeaCard({ title, notes, tags = [], date, archived = false, shape = 'fluid', bitten = false, biteBackground = 'var(--surface-page)', seed, onClick, actions, style }) {
  const [hover, setHover] = React.useState(false);
  const radius = shape === 'fluid' ? fluidRadius(seed || title || '') : 'var(--radius-lg)';
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
      {bitten && <Bite background={biteBackground} border="var(--nug-ink-200)" />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <h3 style={{ width: '100%', fontSize: 'var(--text-title-3)', fontWeight: 'var(--weight-bold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{truncate(title, 40)}</h3>
        {notes && <p style={{ width: '100%', margin: 0, fontSize: 'var(--text-body-sm)', lineHeight: 'var(--leading-normal)', color: 'var(--nug-ink-700)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{clampSentences(notes, 2)}</p>}
        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: 6, marginTop: 1, paddingBottom: 2, scrollbarWidth: 'none' }}>
            {tags.map(t => <Tag key={t} name={t} />)}
          </div>
        )}
      </div>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 'auto', paddingTop: 2 }}>
        {date && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--nug-ink-500)', whiteSpace: 'nowrap' }}>{date}</span>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>{actions}</div>
      </div>
    </article>
  );
}
