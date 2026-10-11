import React from 'react';
import { Shell } from '../components/Shell';
import { useLook, viewFor } from './look';

/**
 * The Comic shell is its own chunk: its fonts, tokens, CSS and code download
 * only when the Comic look is drawn, so Classic users never fetch them.
 */
const ComicShell = React.lazy(() => import('./comic/ComicShell'));

/**
 * The page frame for the current Look, chosen the way pages choose views
 * (`viewFor`, Classic as the fallback).
 *
 * While the Comic chunk loads this draws nothing rather than the Classic
 * shell: Classic first would paint the wrong Look and then remount every
 * route's state (refetching the bank, dropping an open form) once Comic
 * arrived. The server stamps the Look before first paint and the chunk is
 * served from the same binary, so the wait is brief.
 */
export function LookShell() {
  const look = useLook();
  return viewFor(look, {
    classic: <Shell />,
    comic: (
      <React.Suspense fallback={null}>
        <ComicShell />
      </React.Suspense>
    ),
  });
}
