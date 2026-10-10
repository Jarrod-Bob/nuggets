import './fonts.css';
import './tokens.css';
import './comic.css';
import './ui/ui.css';
import { Link, Outlet } from 'react-router-dom';
import { BugReportButton } from '../../components/feedback/BugReportButton';
import { TopBarSlot, type TopBarContent } from '../../components/navigation/TopBarSlot';

/**
 * The Comic look's top bar (the design's Strip): the `nuggets.` wordmark, which
 * links back to the bank, then whatever the page's view gives its top bar —
 * search first, actions after. Views are still Classic until #52–#55, so the
 * content is theirs; only the frame is drawn here.
 */
function drawTopBar({ center, right }: TopBarContent) {
  return (
    <header className="comic-strip">
      <Link to="/" className="comic-wordmark" aria-label="nuggets">
        nuggets.
      </Link>
      <div className="comic-strip-center">{center}</div>
      <div className="comic-strip-right">{right}</div>
    </header>
  );
}

/**
 * The app shell in the Comic look: the page frame and footer around the
 * routes, and the top bar they draw. Everything it shows comes from its
 * children and the views' props — it never touches the api (ADR 0002).
 * This module is the Comic chunk's entry, so its fonts and CSS load only here.
 */
export default function ComicShell() {
  return (
    <TopBarSlot.Provider value={drawTopBar}>
      <div className="comic-shell">
        <Outlet />
        <footer className="comic-footer">
          <span>127.0.0.1:7777 · single user · one SQLite file</span>
        </footer>
        <BugReportButton />
      </div>
    </TopBarSlot.Provider>
  );
}
