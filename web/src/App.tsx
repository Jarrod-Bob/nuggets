import { Navigate, Route, Routes } from 'react-router-dom';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import { LookShell } from './looks/LookShell';
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
 *
 * Motion is the app's animation library. LazyMotion `strict` keeps the start-up
 * cost small: use `m.*` components, never `motion.*` (strict throws on those).
 * reducedMotion="user" turns movement off for people who ask for that.
 */
function App() {
  return (
    <MotionConfig reducedMotion="user">
    <LazyMotion features={domAnimation} strict>
    <LiveUpdatesProvider>
      <TagsProvider>
        <Routes>
          <Route element={<LookShell />}>
            <Route path="/" element={<BankRoute />} />
            <Route path="/nuggets/:id" element={<NuggetPage />} />
            <Route path="/trash" element={<TrashRoute />} />
            {/* Any other path falls back to the bank rather than a dead end. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </TagsProvider>
    </LiveUpdatesProvider>
    </LazyMotion>
    </MotionConfig>
  );
}

export default App;
