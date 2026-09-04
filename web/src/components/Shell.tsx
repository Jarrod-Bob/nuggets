import { Outlet } from 'react-router-dom';

/**
 * The app shell: the page background, the centred content column and the footer
 * that every route sits inside. The routes render their own top bar and <main>
 * into the Outlet — the top bar's contents (search, actions, a back button) are
 * route-specific, so each route owns them, while this frame stays constant.
 */
export function Shell() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', display: 'flex', flexDirection: 'column' }}>
      <Outlet />
      <footer style={{ padding: '0 var(--gutter-web) 22px', display: 'flex', justifyContent: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--nug-ink-500)' }}>
          127.0.0.1:7777 · single user · one SQLite file
        </span>
      </footer>
    </div>
  );
}

/** The centred content column each route renders its body into. */
export function Main({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ flex: 1, width: '100%', maxWidth: 1240, margin: '0 auto', padding: '28px var(--gutter-web) 72px' }}>
      {children}
    </main>
  );
}
