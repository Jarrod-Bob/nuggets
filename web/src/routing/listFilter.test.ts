import { describe, expect, it } from 'vitest';
import { filterFromParams, paramsFromFilter } from './listFilter';

describe('filterFromParams / paramsFromFilter', () => {
  it('round-trips a filter with both q and tag', () => {
    const filter = { q: 'recipe', tag: 'saas' };
    expect(filterFromParams(paramsFromFilter(filter))).toEqual(filter);
  });

  it('round-trips the params for a filtered view', () => {
    const params = new URLSearchParams('q=recipe&tag=saas');
    expect(paramsFromFilter(filterFromParams(params)).toString()).toBe('q=recipe&tag=saas');
  });

  it('maps empty params to an empty filter, and back to an empty string', () => {
    expect(filterFromParams(new URLSearchParams())).toEqual({});
    expect(paramsFromFilter({}).toString()).toBe('');
  });

  it('treats whitespace-only values as absent', () => {
    expect(filterFromParams(new URLSearchParams('q=%20%20&tag='))).toEqual({});
  });

  it('round-trips a tag with characters that need encoding', () => {
    const filter = { tag: 'weekend project & c++' };
    const params = paramsFromFilter(filter);
    // The raw query string is percent-encoded...
    expect(params.toString()).not.toContain(' ');
    expect(params.toString()).toContain('%');
    // ...but decodes back to exactly the original tag.
    expect(filterFromParams(params)).toEqual(filter);
  });

  it('ignores unknown params rather than breaking', () => {
    expect(filterFromParams(new URLSearchParams('q=idea&sort=oldest&page=3'))).toEqual({ q: 'idea' });
  });

  it('round-trips a status filter alongside q and tag', () => {
    const filter = { q: 'recipe', tag: 'saas', status: 'building' as const };
    expect(filterFromParams(paramsFromFilter(filter))).toEqual(filter);
  });

  it('ignores a status value outside the known set', () => {
    expect(filterFromParams(new URLSearchParams('q=idea&status=bogus'))).toEqual({ q: 'idea' });
  });
});
