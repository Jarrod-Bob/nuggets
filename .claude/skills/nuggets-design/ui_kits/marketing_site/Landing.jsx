const { Button, Wordmark, NuggetMark, Card, Badge, IdeaCard, Tag } = window.NuggetsDesignSystem_33854b;

const icon = (name, size = 18) => React.createElement('i', { 'data-lucide': name, style: { width: size, height: size, display: 'flex' } });

const FEATURES = [
  { icon: 'pencil-line', title: 'Capture', body: 'An idea as a title plus notes, tagged however you like.' },
  { icon: 'hash', title: 'Tag', body: 'Tags autocomplete from ones already used, so you never end up with #saas and #SaaS.' },
  { icon: 'search', title: 'Find', body: 'Search the text, or filter by tag. Both at once narrows to ideas matching both.' },
  { icon: 'dices', title: 'Draw a random nugget', body: 'One button returns a random idea as a mini-challenge. Reroll as often as you like.' },
  { icon: 'archive', title: 'Archive, never delete', body: 'A trash view to restore from. Losing an idea should take deliberate effort.' },
];

const STACK = [
  ['Backend', 'Go — stdlib net/http, SQLite via modernc.org/sqlite, goose migrations'],
  ['Frontend', 'TypeScript, React, Vite, Tailwind, a little shadcn/ui'],
  ['Shape', 'One Go binary serving the API and the embedded frontend at 127.0.0.1:7777'],
  ['Data', 'A single SQLite file. Backup is copying it.'],
];

function Section({ background, children, style }) {
  return <section style={{ background, padding: '84px var(--gutter-marketing)', ...style }}>
    <div style={{ maxWidth: 'var(--page-max)', margin: '0 auto' }}>{children}</div>
  </section>;
}

function Landing() {
  const [drawn, setDrawn] = React.useState(0);
  const demo = [
    { title: 'Tailnet-only sharing', notes: 'Expose the bank over Tailscale so the phone can reach it.', tags: ['go', 'infra'] },
    { title: 'Draw a nugget, then timebox it', notes: 'The random draw picks an idea and starts a 25-minute timer.', tags: ['product'] },
    { title: 'FTS5 search when LIKE stops being enough', notes: 'The driver already ships it. Not worth it below a few thousand rows.', tags: ['go', 'search'] },
  ];
  React.useEffect(() => { if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 2.2 } }); });

  return (
    <div style={{ background: 'var(--surface-page)' }}>
      <nav style={{ position: 'sticky', top: 0, zIndex: 30, height: 68, display: 'flex', alignItems: 'center', gap: 20, padding: '0 var(--gutter-marketing)', background: 'var(--nug-cream-50)', borderBottom: 'var(--border-hairline) solid var(--nug-ink-200)' }}>
        <Wordmark size={24} />
        <span style={{ flex: 1 }} />
        <Badge tone="golden">Designed, not built yet</Badge>
        <Button variant="ghost" size="sm" iconLeft={icon('github', 16)}>View the repo</Button>
      </nav>

      <Section background="var(--nug-cream-100)" style={{ backgroundImage: 'var(--texture-breading)', backgroundSize: 'var(--texture-breading-size)', paddingTop: 96, paddingBottom: 96 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: 56, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 22 }}>
            <h1 style={{ fontSize: 'var(--text-display-1)', lineHeight: 'var(--leading-tight)', textWrap: 'pretty' }}>An idea bank for the ideas you keep losing.</h1>
            <p style={{ margin: 0, maxWidth: '46ch', fontSize: 'var(--text-body-lg)', lineHeight: 'var(--leading-loose)', color: 'var(--nug-ink-700)', textWrap: 'pretty' }}>
              nuggets stores every idea you thought was cool to build at some point in your life — with enough structure to find one on purpose, and a button to surface one at random when you feel like a challenge.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Button size="lg" iconLeft={icon('github', 18)}>Read the design spec</Button>
              <Button size="lg" variant="ghost">See the app</Button>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-500)' }}>Local-first · single user · zero recurring cost</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <NuggetMark variant="trio" size={430} />
          </div>
        </div>
      </Section>

      <Section background="var(--nug-white)">
        <div style={{ display: 'grid', gridTemplateColumns: '.9fr 1.1fr', gap: 56, alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 'var(--text-label)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase', color: 'var(--nug-ink-500)' }}>Why</span>
            <h2 style={{ marginTop: 12, fontSize: 'var(--text-display-2)', lineHeight: 'var(--leading-snug)', textWrap: 'pretty' }}>The idea isn't lost exactly.</h2>
            <p style={{ marginTop: 16, maxWidth: '46ch', fontSize: 'var(--text-body-lg)', lineHeight: 'var(--leading-loose)', color: 'var(--nug-ink-700)', textWrap: 'pretty' }}>
              Ideas turn up when you're out, so they get typed into Telegram or WhatsApp as messages to yourself. They survive there, but they end up buried among links, reminders and everything else saved to the same thread. It's just never found again — which comes to the same thing.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {demo.map((d, i) => <IdeaCard key={d.title} {...d} date={['2d ago', '4d ago', '3w ago'][i]} biteBackground="var(--nug-white)" bitten={i === drawn} />)}
            <button type="button" onClick={() => setDrawn((drawn + 1) % 3)}
              style={{ alignSelf: 'flex-start', marginTop: 4, border: 'none', background: 'transparent', cursor: 'pointer', font: 'inherit', fontSize: 'var(--text-body-sm)', color: 'var(--nug-golden-700)', padding: 0 }}>
              Draw another →
            </button>
          </div>
        </div>
      </Section>

      <Section background="var(--nug-cream-100)">
        <h2 style={{ fontSize: 'var(--text-display-2)', marginBottom: 8 }}>What it does</h2>
        <p style={{ margin: '0 0 36px', fontSize: 'var(--text-body-lg)', color: 'var(--nug-ink-700)' }}>Five things. That's the whole scope, deliberately.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {FEATURES.map(f => (
            <Card key={f.title} tone="plain" padding={22} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 34, borderRadius: 'var(--radius-nugget)', background: 'var(--nug-golden-200)', border: 'var(--border-regular) solid var(--nug-golden-600)', color: 'var(--nug-golden-700)' }}>{icon(f.icon, 18)}</span>
              <h3 style={{ fontSize: 'var(--text-title-3)' }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-700)', textWrap: 'pretty' }}>{f.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section background="var(--nug-ink-900)" style={{ color: 'var(--nug-cream-50)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '.85fr 1.15fr', gap: 56 }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-display-2)', color: 'var(--nug-cream-50)', textWrap: 'pretty' }}>Zero cost, no asterisks.</h2>
            <p style={{ marginTop: 16, fontSize: 'var(--text-body-lg)', lineHeight: 'var(--leading-loose)', color: 'var(--nug-cream-200)', textWrap: 'pretty' }}>
              No account, no cloud, no service. One binary, one SQLite file on your own machine, and a browser tab that opens itself.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: 'var(--border-regular) solid rgba(253,244,227,.16)' }}>
            {STACK.map(([k, v]) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '128px 1fr', gap: 18, padding: '15px 20px', background: 'rgba(253,244,227,.05)' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-bold)', color: 'var(--nug-golden-300)' }}>{k}</span>
                <span style={{ fontSize: 'var(--text-body-sm)', color: 'var(--nug-cream-200)', lineHeight: 'var(--leading-normal)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section background="var(--nug-cream-100)" style={{ paddingTop: 68, paddingBottom: 68 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          <NuggetMark variant="single" size={104} bitten />
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 'var(--text-title-1)', textWrap: 'pretty' }}>There's nothing to install yet.</h2>
            <p style={{ margin: '10px 0 0', maxWidth: '58ch', fontSize: 'var(--text-body-md)', color: 'var(--nug-ink-700)', textWrap: 'pretty' }}>
              The full design is public — data model, API, and the reasoning behind each stack choice. This section gets setup instructions once there's something to set up.
            </p>
          </div>
          <Button size="lg" iconLeft={icon('github', 18)}>Read the spec</Button>
        </div>
      </Section>

      <footer style={{ padding: '30px var(--gutter-marketing)', background: 'var(--nug-cream-50)', borderTop: 'var(--border-hairline) solid var(--nug-ink-200)' }}>
        <div style={{ maxWidth: 'var(--page-max)', margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <Wordmark size={18} />
          <span style={{ flex: 1 }} />
          <span style={{ display: 'flex', gap: 6 }}><Tag name="go" /><Tag name="sqlite" /><Tag name="local-first" /></span>
        </div>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Landing />);
