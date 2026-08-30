import { describe, expect, it } from 'vitest';
import { formatRelative } from './formatRelative';

const REF = new Date('2026-08-30T12:00:00.000Z');

describe('formatRelative', () => {
  it('renders "just now" for a timestamp seconds ago', () => {
    expect(formatRelative('2026-08-30T11:59:45.000Z', REF)).toBe('just now');
  });

  it('renders minutes ago', () => {
    expect(formatRelative('2026-08-30T11:45:00.000Z', REF)).toBe('15m ago');
  });

  it('renders hours ago', () => {
    expect(formatRelative('2026-08-30T06:00:00.000Z', REF)).toBe('6h ago');
  });

  it('renders days ago', () => {
    expect(formatRelative('2026-08-28T12:00:00.000Z', REF)).toBe('2d ago');
  });

  it('renders weeks ago', () => {
    expect(formatRelative('2026-08-16T12:00:00.000Z', REF)).toBe('2w ago');
  });

  it('renders months ago', () => {
    expect(formatRelative('2026-05-30T12:00:00.000Z', REF)).toBe('3mo ago');
  });

  it('handles sub-second precision RFC3339 timestamps', () => {
    expect(formatRelative('2026-08-30T11:59:22.6481686Z', REF)).toBe('just now');
  });
});
