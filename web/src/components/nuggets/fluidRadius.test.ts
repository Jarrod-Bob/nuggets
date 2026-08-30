import { describe, expect, it } from 'vitest';
import { fluidRadius } from './fluidRadius';

describe('fluidRadius', () => {
  it('is deterministic, so a card never changes shape between renders', () => {
    expect(fluidRadius('Idea bank')).toBe(fluidRadius('Idea bank'));
  });

  it('gives different seeds different shapes', () => {
    expect(fluidRadius('Idea bank')).not.toBe(fluidRadius('Tiny CLI'));
  });

  it('produces an eight-value border-radius string', () => {
    const [horizontal, vertical] = fluidRadius('Idea bank').split('/');
    expect(horizontal.trim().split(/\s+/)).toHaveLength(4);
    expect(vertical.trim().split(/\s+/)).toHaveLength(4);
  });
});
