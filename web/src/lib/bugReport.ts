/**
 * The "Report a bug" link: GitHub's new-issue page for nuggets' own repository,
 * opened on the bug_report.yml issue form with the environment fields filled in.
 * GitHub pre-fills an issue form field from a query parameter named after the
 * field's `id`, so the keys below must match .github/ISSUE_TEMPLATE/bug_report.yml.
 *
 * Only the route, the build identifier and the user agent ever go into the URL —
 * never settings, tokens, search terms or nugget content. The reporter types
 * the rest on GitHub.
 */

export const BUG_REPORT_REPO = 'Jarrod-Bob/nuggets';
export const BUG_REPORT_TEMPLATE = 'bug_report.yml';

/** The issue form's field ids that the app fills in. */
export const BUG_FIELD = {
  page: 'page',
  version: 'version',
  browser: 'browser',
} as const;

/** Per-field caps, in characters, so the URL stays far below GitHub's ~8 KB limit. */
export const BUG_FIELD_MAX = {
  page: 200,
  version: 64,
  browser: 300,
} as const;

/**
 * The longest URL bugReportUrl can return, with headroom under GitHub's ~8 KB.
 * Even when every capped character is a 4-byte UTF-8 one (an emoji, which
 * percent-encodes to 12 characters), the caps above keep the URL within this.
 */
export const BUG_URL_MAX = 7000;

export interface BugReportContext {
  /** The current route's pathname, e.g. "/nuggets/42". */
  page: string;
  /** The nuggets build identifier. */
  version: string;
  /** navigator.userAgent. */
  userAgent: string;
}

/**
 * Trims a value to at most `max` characters (code points, so an emoji is never
 * split), ending in "…" when it was cut. Control characters become spaces, so a
 * pre-filled one-line input stays on one line.
 */
export function capValue(value: string, max: number): string {
  // eslint-disable-next-line no-control-regex
  const chars = Array.from(value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim());
  if (chars.length <= max) return chars.join('');
  return chars.slice(0, max - 1).join('').trimEnd() + '…';
}

export function bugReportUrl({ page, version, userAgent }: BugReportContext): string {
  const params = new URLSearchParams({ template: BUG_REPORT_TEMPLATE });
  params.set(BUG_FIELD.page, capValue(page, BUG_FIELD_MAX.page));
  params.set(BUG_FIELD.version, capValue(version, BUG_FIELD_MAX.version));
  params.set(BUG_FIELD.browser, capValue(userAgent, BUG_FIELD_MAX.browser));
  return `https://github.com/${BUG_REPORT_REPO}/issues/new?${params.toString()}`;
}
