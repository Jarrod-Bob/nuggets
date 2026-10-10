import { useBank } from '../models/useBank';
import { BankView } from '../looks/classic/BankView';
import { useLook, viewFor } from '../looks/look';

// Comic has no bank view yet, so it shows Classic's.
const views = { classic: BankView };

/** The bank: the model holds what every look shares, the view for the current Look draws it (ADR 0002). */
export function BankRoute() {
  const bank = useBank();
  const View = viewFor(useLook(), views);
  return <View bank={bank} />;
}
