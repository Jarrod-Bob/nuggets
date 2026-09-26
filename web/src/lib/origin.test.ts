import { describe, expect, it } from 'vitest';
import { describeLastSync, describeOrigin } from './origin';

const NOW = new Date('2026-09-26T12:00:00.000Z');

describe('describeOrigin', () => {
  it('names Telegram and how long ago the nugget arrived', () => {
    expect(describeOrigin({ origin: 'Telegram', created_at: '2026-09-23T12:00:00.000Z' }, NOW)).toBe(
      'arrived via Telegram, 3d ago',
    );
  });

  it('names spices', () => {
    expect(describeOrigin({ origin: 'spices', created_at: '2026-09-26T10:00:00.000Z' }, NOW)).toBe(
      'arrived via spices, 2h ago',
    );
  });

  it('says nothing for a nugget typed into the app', () => {
    expect(describeOrigin({ origin: null, created_at: '2026-09-26T10:00:00.000Z' }, NOW)).toBeNull();
  });
});

describe('describeLastSync', () => {
  it('renders how long ago the last sync was', () => {
    expect(describeLastSync('2026-09-26T11:58:00.000Z', NOW)).toBe('last synced 2m ago');
  });

  it('says when there has been no sync', () => {
    expect(describeLastSync(undefined, NOW)).toBe('not synced yet');
  });
});
