import { CATALOG, TIMEBOXES, type LanguageEntry, type TimeboxPreset, type Track } from './challengeCatalog';

/** A uniform draw in [0, 1). Injected so tests can pin the outcome. */
export type Rng = () => number;

export interface Constraint {
  language: string;
  track: Track;
  framework: string;
}

/**
 * Picks one item with odds proportional to its weight. A weight of zero or less
 * is never picked. Throws on an empty or all-zero list, which only a broken
 * catalog can produce. The catalog tests rule that out.
 */
export function weightedPick<T>(items: readonly T[], weight: (item: T) => number, rng: Rng = Math.random): T {
  const total = items.reduce((sum, item) => sum + Math.max(0, weight(item)), 0);
  if (!(total > 0)) throw new Error('weightedPick: nothing to pick from');
  let roll = rng() * total;
  for (const item of items) {
    const w = Math.max(0, weight(item));
    if (roll < w) return item;
    roll -= w;
  }
  // Floating-point slack can leave roll a hair above zero after the last item.
  return [...items].reverse().find((item) => weight(item) > 0)!;
}

export function drawTimebox(rng: Rng = Math.random, presets: readonly TimeboxPreset[] = TIMEBOXES): TimeboxPreset {
  return weightedPick(presets, (p) => p.weight, rng);
}

/**
 * Deals a language, then a track that language has, then a framework listed
 * under that track. Each step only picks from what the step before it allows,
 * so the result is always a pairing that exists in the catalog. Languages are
 * weighted by survey share and tracks are equally likely. Frameworks follow
 * their survey share, or are equally likely when the track has no shares.
 */
export function drawConstraint(rng: Rng = Math.random, catalog: Record<string, LanguageEntry> = CATALOG): Constraint {
  const languages = Object.entries(catalog).filter(([, entry]) => trackNames(entry).length > 0);
  const [language, entry] = weightedPick(languages, ([, e]) => e.share, rng);
  const track = weightedPick(trackNames(entry), () => 1, rng);
  const frameworks = entry.tracks[track]!;
  const surveyed = frameworks.every((f) => f.share !== undefined);
  const framework = weightedPick(frameworks, (f) => (surveyed ? f.share! : 1), rng);
  return { language, track, framework: framework.name };
}

function trackNames(entry: LanguageEntry): Track[] {
  return (Object.keys(entry.tracks) as Track[]).filter((t) => (entry.tracks[t]?.length ?? 0) > 0);
}
