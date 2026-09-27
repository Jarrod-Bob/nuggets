import { Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { TagsProvider } from './tags/TagsProvider';
import { LiveUpdatesProvider } from './live/LiveUpdates';
import { BankRoute } from './pages/BankRoute';
import { NuggetPage } from './pages/NuggetPage';
import { TrashRoute } from './pages/TrashRoute';

/**
 * The app is now three addresses rather than one screen. App holds only the
 * shell — the page frame and footer (via <Shell>) — and the route table; each
 * route owns its own state and renders its top bar and body inside the shell.
 * `tags` is the one piece both routes need, so it lives in a shared provider
 * above the router outlet. Above that, one live-updates stream tells every view
 * when background imports changed something, so it can refetch.
 */
function App() {
  return (
    <LiveUpdatesProvider>
      <TagsProvider>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<BankRoute />} />
            <Route path="/nuggets/:id" element={<NuggetPage />} />
            <Route path="/trash" element={<TrashRoute />} />
            {/* Any other path falls back to the bank rather than a dead end. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </TagsProvider>
    </LiveUpdatesProvider>
  );
}

export default App;
