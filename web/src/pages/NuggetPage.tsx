import { useNuggetPage } from '../models/useNuggetPage';
import { NuggetView } from '../looks/classic/NuggetView';

/** One nugget's page: the model holds what every look shares, the view draws it (ADR 0002). */
export function NuggetPage() {
  const page = useNuggetPage();
  return <NuggetView page={page} />;
}
