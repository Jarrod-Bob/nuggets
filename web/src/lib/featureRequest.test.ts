import { describe, expect, it } from 'vitest';
import { describeQueue, featureRequestView } from './featureRequest';

describe('describeQueue', () => {
  it('names what is waiting', () => {
    expect(describeQueue(0, 0)).toBeNull();
    expect(describeQueue(2, 0)).toBe('2 queued');
    expect(describeQueue(0, 1)).toBe('1 failed');
    expect(describeQueue(3, 1)).toBe('3 queued · 1 failed');
  });
});

describe('featureRequestView', () => {
  it('shows a POST in flight as pending', () => {
    expect(featureRequestView({ state: 'sending' })).toBe('pending');
    expect(featureRequestView({ state: 'pending' })).toBe('pending');
    expect(featureRequestView({ state: 'created' })).toBe('created');
    expect(featureRequestView({ state: 'failed' })).toBe('failed');
  });
});
