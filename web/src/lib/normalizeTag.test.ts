import { describe, expect, it } from 'vitest';
import { normalizeTag } from './normalizeTag';

describe('normalizeTag', () => {
  it('lowercases and trims, matching the server rule', () => {
    expect(normalizeTag('  SaaS ')).toBe('saas');
    expect(normalizeTag('GO')).toBe('go');
  });

  it('is idempotent', () => {
    expect(normalizeTag(normalizeTag(' Weekend '))).toBe('weekend');
  });

  it('collapses to empty for whitespace only', () => {
    expect(normalizeTag('   ')).toBe('');
  });
});
