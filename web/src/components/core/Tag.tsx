import React from 'react';

/**
 * A freeform tag. Tag names are normalised server-side to trimmed lowercase, so
 * always render them lowercase here too. The dot colour is derived
 * deterministically from the name via `dipFor` — the same tag is always the
 * same dip colour, with no colour stored anywhere.
 */
export interface TagProps {
  /** The normalised tag name. Preferred over `children`. */
  name?: string;
  /** Override the derived dip colour. Rarely needed. */
  dip?: 'mustard' | 'bbq' | 'chilli' | 'herb' | 'curry' | 'ranch';
  /** Usage count, shown in mono — used in the tag filter. */
  count?: number;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

type Dip = NonNullable<TagProps['dip']>;

const nugDips: Record<Dip, string> = { mustard: '#F2C230', bbq: '#8B4A2B', chilli: '#E8536A', herb: '#3F9C5D', curry: '#D98324', ranch: '#7C8CDE' };
const nugDipOrder: Dip[] = ['chilli', 'herb', 'mustard', 'ranch', 'bbq', 'curry'];
// FNV-1a with a final xor-fold. A weaker hash (multiply-31 into a modulus that is
// 1 mod 6) collapses short lowercase tag names onto only two indices.
export function dipFor(name = ''): Dip {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  h ^= h >>> 15;
  return nugDipOrder[(h >>> 0) % nugDipOrder.length];
}

export function Tag({ name, dip, count, active = false, onClick, onRemove, children, style }: TagProps) {
  const label = name != null ? name : children;
  const c = nugDips[dip || dipFor(String(label))];
  const clickable = !!onClick;
  return (
    <span onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 26,
      padding: onRemove ? '0 6px 0 10px' : '0 11px',
      borderRadius: 'var(--radius-pill)', background: active ? c : 'var(--nug-cream-50)',
      border: `var(--border-hairline) solid ${active ? c : 'var(--nug-ink-200)'}`,
      color: active ? 'var(--nug-white)' : 'var(--nug-ink-700)',
      fontSize: 'var(--text-body-sm)', fontWeight: 'var(--weight-semibold)',
      cursor: clickable ? 'pointer' : 'default', userSelect: 'none',
      transition: 'all var(--dur-fast) var(--ease-out)', ...style,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 'var(--radius-nugget)', background: active ? 'var(--nug-white)' : c, flex: 'none' }} />
      {label}
      {count != null && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', opacity: .7 }}>{count}</span>}
      {onRemove && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} aria-label={`Remove ${label}`}
          style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 3px' }}>×</button>
      )}
    </span>
  );
}
