import React from 'react';
import { Navigate } from 'react-router-dom';
import { useBucket } from '../models/useBucket';
import { readLook, useLook } from '../looks/look';

/** The bucket is Comic-only and its view is a chunk of its own, fetched only when it is opened (ADR 0002). */
const ComicBucketView = React.lazy(() => import('../looks/comic/BucketView'));

/**
 * The bucket (issue #57): a live nugget counter that exists in the Comic look
 * only; Classic goes back to the bank. The model lives in `ComicBucket`, above
 * the lazy view, so it only fetches under Comic and survives the chunk arriving.
 */
export function BucketRoute() {
  const look = useLook();
  // Unstamped (the Vite dev server), `look` reads Classic until the saved Look
  // arrives: that's a placeholder, not a reason to leave.
  if (readLook() === undefined) return null;
  if (look !== 'comic') return <Navigate to="/" replace />;
  return <ComicBucket />;
}

function ComicBucket() {
  const bucket = useBucket();
  return (
    <React.Suspense fallback={null}>
      <ComicBucketView bucket={bucket} />
    </React.Suspense>
  );
}
