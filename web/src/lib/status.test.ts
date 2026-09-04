import { describe, it, expect } from 'vitest';
import { statusLabel, statusTone, isActedOn, linkText } from './status';

describe('status helpers', () => {
  it('maps each status to its badge tone', () => {
    expect(statusTone('raw')).toBe('neutral');
    expect(statusTone('exploring')).toBe('golden');
    expect(statusTone('building')).toBe('herb');
    expect(statusTone('parked')).toBe('ink');
    expect(statusTone('killed')).toBe('ketchup');
  });

  it('labels statuses in title case', () => {
    expect(statusLabel('raw')).toBe('Raw');
    expect(statusLabel('exploring')).toBe('Exploring');
  });

  it('treats anything past raw as acted on', () => {
    expect(isActedOn('raw')).toBe(false);
    expect(isActedOn('exploring')).toBe(true);
    expect(isActedOn('killed')).toBe(true);
  });
});

describe('linkText', () => {
  it('uses the label when one is given', () => {
    expect(linkText('https://github.com/x/y', 'the repo')).toBe('the repo');
  });

  it('falls back to the URL host when the label is blank', () => {
    expect(linkText('https://github.com/x/y', '')).toBe('github.com');
    expect(linkText('https://docs.example.com/page', '   ')).toBe('docs.example.com');
  });

  it('falls back to the raw string when the URL cannot be parsed', () => {
    expect(linkText('not a url', '')).toBe('not a url');
  });
});
