import React from 'react';
import { useBank } from '../models/useBank';
import { BankView } from '../looks/classic/BankView';
import { useLook, viewFor } from '../looks/look';

/** The Comic bank is its own chunk, fetched only when the Comic Look is drawn (ADR 0002). */
const ComicBankView = React.lazy(() => import('../looks/comic/BankView'));

/**
 * The bank: the model holds what every look shares, the view for the current
 * Look draws it. The model lives here, above the lazy view, so the bank's
 * state (filters, an open dialog) survives the Comic chunk arriving.
 */
export function BankRoute() {
  const bank = useBank();
  return viewFor(useLook(), {
    classic: <BankView bank={bank} />,
    comic: (
      <React.Suspense fallback={null}>
        <ComicBankView bank={bank} />
      </React.Suspense>
    ),
  });
}
