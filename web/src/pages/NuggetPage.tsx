import React from 'react';
import { useNuggetPage } from '../models/useNuggetPage';
import { NuggetView } from '../looks/classic/NuggetView';
import { useLook, viewFor } from '../looks/look';

/** The Comic nugget page is its own chunk, fetched only when the Comic Look is drawn (ADR 0002). */
const ComicNuggetView = React.lazy(() => import('../looks/comic/NuggetView'));

/**
 * One nugget's page: the model holds what every look shares, the view for the
 * current Look draws it (ADR 0002). The model lives here, above the lazy view,
 * so the page's state (an open dialog, unsaved edits) survives the Comic chunk
 * arriving.
 */
export function NuggetPage() {
  const page = useNuggetPage();
  return viewFor(useLook(), {
    classic: <NuggetView page={page} />,
    comic: (
      <React.Suspense fallback={null}>
        <ComicNuggetView page={page} />
      </React.Suspense>
    ),
  });
}
