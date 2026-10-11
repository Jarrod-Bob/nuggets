import { useTrash } from '../models/useTrash';
import { TrashView } from '../looks/classic/TrashView';
import { useLook, viewFor } from '../looks/look';

/** The trash: the model holds what every look shares, the view for the current Look draws it (ADR 0002). */
export function TrashRoute() {
  const trash = useTrash();
  // Comic has no trash view yet, so it shows Classic's.
  return viewFor(useLook(), { classic: <TrashView trash={trash} /> });
}
