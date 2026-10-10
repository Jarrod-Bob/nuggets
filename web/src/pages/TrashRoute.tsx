import { useTrash } from '../models/useTrash';
import { TrashView } from '../looks/classic/TrashView';

/** The trash: the model holds what every look shares, the view draws it (ADR 0002). */
export function TrashRoute() {
  const trash = useTrash();
  return <TrashView trash={trash} />;
}
