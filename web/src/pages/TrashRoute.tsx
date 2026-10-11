import React from 'react';
import { useTrash } from '../models/useTrash';
import { TrashView } from '../looks/classic/TrashView';
import { useLook, viewFor } from '../looks/look';

/** The Comic bin is its own chunk, fetched only when the Comic Look is drawn (ADR 0002). */
const ComicTrashView = React.lazy(() => import('../looks/comic/TrashView'));

/**
 * The trash: the model holds what every look shares, the view for the current
 * Look draws it. The model lives here, above the lazy view, so the trash's
 * state (an open purge confirmation) survives the Comic chunk arriving.
 */
export function TrashRoute() {
  const trash = useTrash();
  return viewFor(useLook(), {
    classic: <TrashView trash={trash} />,
    comic: (
      <React.Suspense fallback={null}>
        <ComicTrashView trash={trash} />
      </React.Suspense>
    ),
  });
}
