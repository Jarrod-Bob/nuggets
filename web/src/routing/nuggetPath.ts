/**
 * Path helpers for the single-nugget route (`/nuggets/:id`), kept pure so the id
 * parsing is testable without mounting a router.
 *
 * `parseNuggetId` is deliberately strict: a non-numeric or non-positive `:id`
 * resolves to `null` so the page renders the not-found state rather than firing
 * an API call with a nonsense id. Ids are positive integers (SQLite rowids), so
 * anything else — `abc`, `4.5`, `-1`, `0` — is not a real address.
 */
export function nuggetPath(id: number | string): string {
  return `/nuggets/${id}`;
}

export function parseNuggetId(param: string | undefined): number | null {
  if (!param || !/^[1-9][0-9]*$/.test(param)) return null;
  const id = Number(param);
  return Number.isSafeInteger(id) ? id : null;
}
