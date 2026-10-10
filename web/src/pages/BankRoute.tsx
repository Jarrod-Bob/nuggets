import { useBank } from '../models/useBank';
import { BankView } from '../looks/classic/BankView';

/** The bank: the model holds what every look shares, the view draws it (ADR 0002). */
export function BankRoute() {
  const bank = useBank();
  return <BankView bank={bank} />;
}
