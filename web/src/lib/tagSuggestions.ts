/** Where TypeSafe issues API keys. */
export const TYPESAFE_KEYS_URL = 'https://console.typesafe.ai/keys';

/** "N nuggets waiting to be checked", or null when none are. */
export function describePending(pending: number): string | null {
  if (pending <= 0) return null;
  return `${pending} ${pending === 1 ? 'nugget' : 'nuggets'} waiting to be checked`;
}
