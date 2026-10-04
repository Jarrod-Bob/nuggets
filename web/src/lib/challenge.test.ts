import { describe, it, expect } from 'vitest';
import { drawConstraint, drawTimebox, weightedPick, type Rng } from './challenge';
import { CATALOG, TIMEBOXES, type LanguageEntry } from './challengeCatalog';

/** Replays the given rolls in order, then repeats the last one. */
const rolls = (...values: number[]): Rng => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

/** A seeded LCG, so the many-draws tests are repeatable. */
const seeded = (seed: number): Rng => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

describe('weightedPick', () => {
  const items = [{ id: 'a', w: 1 }, { id: 'b', w: 3 }, { id: 'zero', w: 0 }];

  it('maps the roll onto cumulative weights', () => {
    expect(weightedPick(items, (i) => i.w, rolls(0)).id).toBe('a');
    expect(weightedPick(items, (i) => i.w, rolls(0.24)).id).toBe('a');
    expect(weightedPick(items, (i) => i.w, rolls(0.25)).id).toBe('b');
    expect(weightedPick(items, (i) => i.w, rolls(0.9999)).id).toBe('b');
  });

  it('never picks a zero-weight item', () => {
    const rng = seeded(1);
    for (let n = 0; n < 500; n++) expect(weightedPick(items, (i) => i.w, rng).id).not.toBe('zero');
  });

  it('refuses an empty or all-zero list', () => {
    expect(() => weightedPick([], () => 1)).toThrow();
    expect(() => weightedPick([{ w: 0 }], (i) => i.w)).toThrow();
  });
});

describe('drawTimebox', () => {
  it('always returns one of the presets', () => {
    const rng = seeded(7);
    for (let n = 0; n < 200; n++) expect(TIMEBOXES).toContain(drawTimebox(rng));
  });

  it('lands on the short presets more often than a weekend', () => {
    const rng = seeded(42);
    const counts = new Map<string, number>();
    for (let n = 0; n < 4000; n++) {
      const t = drawTimebox(rng);
      counts.set(t.label, (counts.get(t.label) ?? 0) + 1);
    }
    expect(counts.get('90 minutes')!).toBeGreaterThan(counts.get('A weekend')! * 2);
  });

  it('never rerolls onto the timebox already showing', () => {
    const rng = seeded(5);
    for (const current of TIMEBOXES)
      for (let n = 0; n < 200; n++) expect(drawTimebox(rng, current).label).not.toBe(current.label);
  });

  it('leaves the other presets weighted as before on a reroll', () => {
    // Without '90 minutes' (4), the rest weigh 3/2/1: a roll of 0.5 lands on 'A day'.
    expect(drawTimebox(rolls(0.5), TIMEBOXES[0]).label).toBe(TIMEBOXES[2].label);
  });

  it('rerolls onto the same timebox when it is the only preset', () => {
    const only = [{ label: 'Only', minutes: 60, weight: 1 }];
    expect(drawTimebox(rolls(0.5), only[0], only)).toBe(only[0]);
  });
});

describe('drawConstraint', () => {
  it('only deals pairings that exist in the catalog', () => {
    const rng = seeded(3);
    for (let n = 0; n < 2000; n++) {
      const { language, track, framework } = drawConstraint(rng);
      const names = CATALOG[language].tracks[track]?.map((f) => f.name);
      expect(names, `${language}/${track}`).toContain(framework);
    }
  });

  it('can reach every language, track and framework in the catalog', () => {
    const rng = seeded(11);
    const seen = new Set<string>();
    for (let n = 0; n < 60000; n++) {
      const c = drawConstraint(rng);
      seen.add(`${c.language}|${c.track}|${c.framework}`);
    }
    for (const [language, entry] of Object.entries(CATALOG))
      for (const [track, frameworks] of Object.entries(entry.tracks))
        for (const f of frameworks!) expect(seen, `${language}/${track}/${f.name}`).toContain(`${language}|${track}|${f.name}`);
  });

  it('weights languages by survey share, then tracks evenly, then frameworks by share', () => {
    const catalog: Record<string, LanguageEntry> = {
      Big: { share: 75, tracks: { cli: [{ name: 'big-cli' }], mobile: [{ name: 'm1', share: 10 }, { name: 'm2', share: 30 }] } },
      Small: { share: 25, tracks: { cli: [{ name: 'small-cli' }] } },
    };
    // language roll 0.5 → Big (0–0.75); track roll 0.6 → mobile (second of two); framework roll 0.3 → m2 (0.25–1).
    expect(drawConstraint(rolls(0.5, 0.6, 0.3), null, catalog)).toEqual({ language: 'Big', track: 'mobile', framework: 'm2' });
    // framework roll 0.2 → m1 (0–0.25).
    expect(drawConstraint(rolls(0.5, 0.6, 0.2), null, catalog).framework).toBe('m1');
    // language roll 0.8 → Small.
    expect(drawConstraint(rolls(0.8, 0, 0), null, catalog)).toEqual({ language: 'Small', track: 'cli', framework: 'small-cli' });
  });

  it('never rerolls onto the pairing already showing, and still deals a catalog pairing', () => {
    const rng = seeded(9);
    let current = drawConstraint(rng);
    for (let n = 0; n < 3000; n++) {
      const next = drawConstraint(rng, current);
      expect(next).not.toEqual(current);
      expect(CATALOG[next.language].tracks[next.track]?.map((f) => f.name)).toContain(next.framework);
      current = next;
    }
  });

  it('only drops the exact pairing showing on a reroll', () => {
    const catalog: Record<string, LanguageEntry> = {
      Solo: { share: 90, tracks: { cli: [{ name: 'solo-cli' }] } },
      Pair: { share: 10, tracks: { cli: [{ name: 'p1', share: 1 }, { name: 'p2', share: 3 }] } },
    };
    // With Solo's only pairing out, Pair is the only language left, and p1/p2 keep their 1:3 odds.
    expect(drawConstraint(rolls(0, 0, 0.2), { language: 'Solo', track: 'cli', framework: 'solo-cli' }, catalog))
      .toEqual({ language: 'Pair', track: 'cli', framework: 'p1' });
    expect(drawConstraint(rolls(0, 0, 0.3), { language: 'Solo', track: 'cli', framework: 'solo-cli' }, catalog).framework).toBe('p2');
    // Dropping p1 leaves Pair's p2 and Solo in play.
    expect(drawConstraint(rolls(0.95, 0, 0), { language: 'Pair', track: 'cli', framework: 'p1' }, catalog))
      .toEqual({ language: 'Pair', track: 'cli', framework: 'p2' });
  });

  it('rerolls onto the same pairing when it is the only one in the catalog', () => {
    const catalog: Record<string, LanguageEntry> = { Only: { share: 5, tracks: { cli: [{ name: 'only' }] } } };
    const current = { language: 'Only', track: 'cli' as const, framework: 'only' };
    expect(drawConstraint(rolls(0.5), current, catalog)).toEqual(current);
  });

  it('skips a language with no frameworks rather than dealing an empty pairing', () => {
    const catalog: Record<string, LanguageEntry> = {
      Empty: { share: 99, tracks: { cli: [] } },
      Real: { share: 1, tracks: { cli: [{ name: 'only' }] } },
    };
    expect(drawConstraint(rolls(0), null, catalog)).toEqual({ language: 'Real', track: 'cli', framework: 'only' });
  });
});
