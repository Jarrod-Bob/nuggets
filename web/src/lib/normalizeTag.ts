/**
 * Previews the server's tag rule so the lowercase normalization is never a
 * surprise in the combobox. The server owns the rule; this only mirrors it.
 */
export function normalizeTag(name: string): string {
  return name.trim().toLowerCase();
}
