import { useTrash } from '../models/useTrash';
import { TrashView } from '../looks/classic/TrashView';
import { useLook, viewFor } from '../looks/look';

// Comic has no trash view yet, so it shows Classic's.
const views = { classic: TrashView };

/** The trash: the model holds what every look shares, the view for the current Look draws it (ADR 0002). */
export function TrashRoute() {
  const trash = useTrash();
  const View = viewFor(useLook(), views);
  return <View trash={trash} />;
}
