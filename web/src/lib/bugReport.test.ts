import { describe, expect, it } from 'vitest';
import { BUG_FIELD, BUG_FIELD_MAX, BUG_URL_MAX, bugReportUrl, capValue } from './bugReport';

const ctx = { page: '/nuggets/42', version: 'adee785', userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0' };

describe('bugReportUrl', () => {
  it("opens nuggets' new-issue page on the bug report form", () => {
    const url = new URL(bugReportUrl(ctx));
    expect(url.origin + url.pathname).toBe('https://github.com/Jarrod-Bob/nuggets/issues/new');
    expect(url.searchParams.get('template')).toBe('bug_report.yml');
  });

  it("pre-fills the form's environment fields by id", () => {
    const params = new URL(bugReportUrl(ctx)).searchParams;
    expect(BUG_FIELD).toEqual({ page: 'page', version: 'version', browser: 'browser' });
    expect(params.get('page')).toBe('/nuggets/42');
    expect(params.get('version')).toBe('adee785');
    expect(params.get('browser')).toBe(ctx.userAgent);
    expect([...params.keys()]).toEqual(['template', 'page', 'version', 'browser']);
  });

  it('encodes characters that would otherwise break the query string', () => {
    const raw = bugReportUrl({ page: '/a b&c=d#e?f', version: 'v+1', userAgent: 'Bröwser 🍗 100%' });
    expect(raw).not.toContain(' ');
    expect(raw).not.toContain('#');
    expect(raw.split('?')).toHaveLength(2);
    const params = new URL(raw).searchParams;
    expect(params.get('page')).toBe('/a b&c=d#e?f');
    expect(params.get('version')).toBe('v+1');
    expect(params.get('browser')).toBe('Bröwser 🍗 100%');
  });

  it('caps each pre-filled value', () => {
    const params = new URL(bugReportUrl({ page: '/' + 'p'.repeat(1000), version: 'v'.repeat(1000), userAgent: 'u'.repeat(5000) })).searchParams;
    expect(Array.from(params.get('page')!)).toHaveLength(BUG_FIELD_MAX.page);
    expect(Array.from(params.get('version')!)).toHaveLength(BUG_FIELD_MAX.version);
    expect(Array.from(params.get('browser')!)).toHaveLength(BUG_FIELD_MAX.browser);
    expect(params.get('browser')!.endsWith('…')).toBe(true);
  });

  it('stays under the URL budget even when every character percent-encodes to the longest form', () => {
    const wide = '🍗'.repeat(10_000);
    const url = bugReportUrl({ page: wide, version: wide, userAgent: wide });
    expect(url.length).toBeLessThanOrEqual(BUG_URL_MAX);
  });
});

describe('capValue', () => {
  it('leaves short values alone', () => {
    expect(capValue('/trash', 200)).toBe('/trash');
  });

  it('cuts long values with an ellipsis, never splitting an emoji', () => {
    expect(capValue('abcdef', 4)).toBe('abc…');
    expect(capValue('🍗🍗🍗🍗🍗', 3)).toBe('🍗🍗…');
  });

  it('flattens control characters so a one-line field stays on one line', () => {
    expect(capValue('a\nb\r\n\tc\u0000', 50)).toBe('a b c');
  });
});
