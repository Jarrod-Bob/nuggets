import { useBank } from '../models/useBank';
import { BankView } from '../looks/classic/BankView';
import { useLook, viewFor } from '../looks/look';

/** The bank: the model holds what every look shares, the view for the current Look draws it (ADR 0002). */
export function BankRoute() {
  const bank = useBank();
  // Comic has no bank view yet, so it shows Classic's.
  return viewFor(useLook(), { classic: <BankView bank={bank} /> });
}
