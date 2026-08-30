import React from 'react';
import { Dialog } from '../feedback/Dialog';
import { Button } from '../core/Button';
import { Tag } from '../core/Tag';

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
  /**
   * True while the caller's draw source (e.g. an in-flight fetch) hasn't
   * resolved yet for the current `tag`. While true, the dialog shows a
   * neutral loading state instead of "nothing to draw" — the two are not
   * the same thing and must not read the same to the user.
   */
  loading?: boolean;
  buttonLabel?: string;
  buttonVariant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  style?: React.CSSProperties;
}

export function RandomNugget({ tag = null, onDraw, loading = false, buttonLabel = 'Draw a nugget', buttonVariant = 'secondary', style }: RandomNuggetProps) {
  const [open, setOpen] = React.useState(false);
  const [idea, setIdea] = React.useState<RandomIdea | null>(null);
  const draw = () => { const next = onDraw ? onDraw(tag) : null; setIdea(next); setOpen(true); };
  return (
    <>
      <Button variant={buttonVariant} onClick={draw} disabled={loading} style={style}
        iconLeft={<span style={{ width: 15, height: 12, borderRadius: 'var(--radius-nugget)', background: 'var(--nug-golden-400)', border: '1.5px solid var(--nug-golden-700)', display: 'block' }} />}>
        {buttonLabel}
      </Button>
      <Dialog open={open} width={480} onClose={() => setOpen(false)}
        title={loading ? 'Drawing…' : idea ? 'Your challenge' : 'Nothing to draw'}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
          <Button variant="secondary" onClick={draw} disabled={loading}>Reroll</Button>
        </>}>
        {loading ? (
          <p style={{ margin: 0, color: 'var(--nug-ink-500)' }}>Drawing a nugget…</p>
        ) : idea ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0 2px' }}>
            {tag && <span style={{ fontSize: 'var(--text-micro)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--nug-ink-500)' }}>narrowed to {tag}</span>}
            <h3 style={{ fontSize: 'var(--text-title-1)', fontWeight: 'var(--weight-bold)', textWrap: 'pretty' }}>{idea.title}</h3>
            {idea.notes && <p style={{ margin: 0, fontSize: 'var(--text-body-md)', color: 'var(--nug-ink-700)', textWrap: 'pretty' }}>{idea.notes}</p>}
            {idea.tags && idea.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>{idea.tags.map(t => <Tag key={t} name={t} />)}</div>
            )}
          </div>
        ) : (
          <p style={{ margin: 0, color: 'var(--nug-ink-500)' }}>No active nuggets match that tag. Drop one in first.</p>
        )}
      </Dialog>
    </>
  );
}
