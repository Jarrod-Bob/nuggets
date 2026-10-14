import React from 'react';
import { Navigate } from 'react-router-dom';
import { useBucket } from '../models/useBucket';
import { readLook, useLook } from '../looks/look';

/** The bucket is Comic-only, so its view is the Comic chunk's (ADR 0002). */
const ComicBucketView = React.lazy(() => import('../looks/comic/BucketView'));

/**
 * The bucket: a live nugget counter that exists in the Comic look only.
 * Classic goes back to the bank. The model lives in the inner component, above
 * the lazy view, so it fetches only under Comic and its state survives the
 * chunk arriving.
 */
export function BucketRoute() {
  const look = useLook();
  // Until the page says which Look it is (the Vite dev server doesn't stamp
  // one), `look` is only a placeholder, not a reason to leave.
  if (readLook() === undefined) return null;
  if (look === 'classic') return <Navigate to="/" replace />;
  return <ComicBucket />;
}

function ComicBucket() {
  const bucket = useBucket();
  if (!bucket.ready && !bucket.loadError) return null;
  return (
    <React.Suspense fallback={null}>
      <ComicBucketView bucket={bucket} />
    </React.Suspense>
  );
}
