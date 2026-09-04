import { describe, expect, it } from 'vitest';
import { nuggetPath, parseNuggetId } from './nuggetPath';

describe('nuggetPath', () => {
  it('builds the route path for a nugget id', () => {
    expect(nuggetPath(42)).toBe('/nuggets/42');
  });

  it('round-trips a path segment back to its id', () => {
    expect(parseNuggetId(nuggetPath(7).split('/').pop())).toBe(7);
  });
});

describe('parseNuggetId', () => {
  it('parses a positive integer id', () => {
    expect(parseNuggetId('42')).toBe(42);
  });

  it('returns null for a non-numeric id (renders not-found, no API call)', () => {
    expect(parseNuggetId('abc')).toBeNull();
  });

  it('returns null for a missing id', () => {
    expect(parseNuggetId(undefined)).toBeNull();
  });

  it('returns null for non-positive-integer ids', () => {
    expect(parseNuggetId('0')).toBeNull();
    expect(parseNuggetId('-1')).toBeNull();
    expect(parseNuggetId('4.5')).toBeNull();
    expect(parseNuggetId('12abc')).toBeNull();
  });

  it('returns null for an id beyond safe-integer range', () => {
    expect(parseNuggetId('99999999999999999999')).toBeNull();
  });
});
