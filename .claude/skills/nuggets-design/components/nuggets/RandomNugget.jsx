import React from 'react';
import { Dialog } from '../feedback/Dialog.jsx';
import { Button } from '../core/Button.jsx';
import { Tag } from '../core/Tag.jsx';

export function RandomNugget({ tag = null, onDraw, buttonLabel = 'Draw a nugget', buttonVariant = 'secondary', style }) {
  const [open, setOpen] = React.useState(false);
  const [idea, setIdea] = React.useState(null);
  const draw = () => { const next = onDraw ? onDraw(tag) : null; setIdea(next); setOpen(true); };
  return (
    <>
      <Button variant={buttonVariant} onClick={draw} style={style}
        iconLeft={<span style={{ width: 15, height: 12, borderRadius: 'var(--radius-nugget)', background: 'var(--nug-golden-400)', border: '1.5px solid var(--nug-golden-700)', display: 'block' }} />}>
        {buttonLabel}
      </Button>
      <Dialog open={open} width={480} onClose={() => setOpen(false)}
        title={idea ? 'Your challenge' : 'Nothing to draw'}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
          <Button variant="secondary" onClick={draw}>Reroll</Button>
        </>}>
        {idea ? (
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
