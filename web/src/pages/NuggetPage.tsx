import { useNuggetPage } from '../models/useNuggetPage';
import { NuggetView } from '../looks/classic/NuggetView';
import { useLook, viewFor } from '../looks/look';

// Comic has no nugget view yet, so it shows Classic's.
const views = { classic: NuggetView };

/** One nugget's page: the model holds what every look shares, the view for the current Look draws it (ADR 0002). */
export function NuggetPage() {
  const page = useNuggetPage();
  const View = viewFor(useLook(), views);
  return <View page={page} />;
}
