import { describe, expect, it } from 'vitest';
import {
  appendToNotes,
  buildDeepLinkPrompt,
  buildPlanPrompt,
  claudeDesktopUrl,
  DEEP_LINK_PROMPT_LIMIT,
  NOTES_TRIMMED_MARKER,
} from './planPrompt';

const full = {
  title: 'Recipe scaler',
  notes: 'Scale a recipe to any number of servings.\nMetric and imperial.',
  tags: ['cooking', 'web'],
  status: 'exploring' as const,
  links: [
    { url: 'https://github.com/me/scaler', label: 'Repo' },
    { url: 'https://example.com/spec', label: '' },
  ],
};

const empty = { title: 'Bare idea', notes: '   ', tags: [], status: 'raw' as const, links: [] };

describe('buildPlanPrompt', () => {
  it('includes every field of the nugget', () => {
    const prompt = buildPlanPrompt(full);
    expect(prompt).toContain('Title: Recipe scaler');
    expect(prompt).toContain('Status: Exploring');
    expect(prompt).toContain('Tags: cooking, web');
    expect(prompt).toContain('Notes:\nScale a recipe to any number of servings.\nMetric and imperial.\n');
    expect(prompt).toContain('Links:\n- Repo: https://github.com/me/scaler\n- https://example.com/spec');
    expect(prompt).toContain('MVP scope');
    expect(prompt).not.toMatch(/\{\{\w+\}\}/);
  });

  it('says so when a field is empty', () => {
    const prompt = buildPlanPrompt(empty);
    expect(prompt).toContain('Title: Bare idea');
    expect(prompt).toContain('Status: Raw');
    expect(prompt).toContain('Tags: (none)');
    expect(prompt).toContain('Notes:\n(none yet)');
    expect(prompt).toContain('Links:\n(none)');
  });

  it('inserts replacement patterns typed into a nugget literally', () => {
    const prompt = buildPlanPrompt({ ...empty, title: "Price in $& and $' and {{notes}}" });
    expect(prompt).toContain("Title: Price in $& and $' and {{notes}}");
  });
});

describe('buildDeepLinkPrompt', () => {
  it('leaves a prompt that fits untouched', () => {
    expect(buildDeepLinkPrompt(full)).toEqual({ prompt: buildPlanPrompt(full), trimmed: false });
  });

  it('trims long notes to fit the limit and marks them', () => {
    const idea = { ...full, notes: 'word '.repeat(5_000) + 'THE-END' };
    const { prompt, trimmed } = buildDeepLinkPrompt(idea);
    expect(trimmed).toBe(true);
    expect(prompt.length).toBeLessThanOrEqual(DEEP_LINK_PROMPT_LIMIT);
    expect(prompt).toContain(NOTES_TRIMMED_MARKER);
    expect(prompt).not.toContain('THE-END');
    // Only the notes are cut: the fields and instructions after them survive.
    expect(prompt).toContain('- Repo: https://github.com/me/scaler');
    expect(prompt).toContain('use headings so I can paste your answer back');
    // The copied prompt stays complete.
    expect(buildPlanPrompt(idea)).toContain('THE-END');
  });

  it('honours a custom limit exactly', () => {
    const idea = { ...full, notes: 'x'.repeat(3_000) };
    const base = buildPlanPrompt({ ...full, notes: '' }).length;
    const { prompt, trimmed } = buildDeepLinkPrompt(idea, base + 500);
    expect(trimmed).toBe(true);
    expect(prompt.length).toBeLessThanOrEqual(base + 500);
    expect(prompt.length).toBeGreaterThan(base + 300);
  });

  it('never splits an emoji when trimming', () => {
    const idea = { ...full, notes: '🍗'.repeat(8_000) };
    const { prompt } = buildDeepLinkPrompt(idea);
    expect(() => encodeURIComponent(prompt)).not.toThrow();
  });

  it('still fits when the rest of the prompt alone is too long', () => {
    const idea = { ...full, title: 'T'.repeat(DEEP_LINK_PROMPT_LIMIT + 10) };
    const { prompt, trimmed } = buildDeepLinkPrompt(idea);
    expect(trimmed).toBe(true);
    expect(prompt.length).toBe(DEEP_LINK_PROMPT_LIMIT);
  });
});

describe('claudeDesktopUrl', () => {
  it('URL-encodes the prompt into q', () => {
    const prompt = 'Plan this: a & b = 100%?\n#tag 🍗';
    const url = claudeDesktopUrl(prompt);
    expect(url).toBe(`claude://claude.ai/new?q=${encodeURIComponent(prompt)}`);
    expect(url.slice('claude://claude.ai/new?q='.length)).not.toMatch(/[ \n&#?=]/);
    expect(new URL(url.replace('claude://', 'https://')).searchParams.get('q')).toBe(prompt);
  });
});

describe('appendToNotes', () => {
  const now = new Date(2026, 9, 2, 12, 0);

  it('appends under a dated heading, keeping existing notes', () => {
    expect(appendToNotes('My notes.\n\n', '  The plan.\n', now)).toBe('My notes.\n\nPlan with Claude (2026-10-02):\nThe plan.');
  });

  it('uses the answer alone when there are no notes yet', () => {
    expect(appendToNotes('', 'The plan.', now)).toBe('Plan with Claude (2026-10-02):\nThe plan.');
    expect(appendToNotes('  \n', 'The plan.', now)).toBe('Plan with Claude (2026-10-02):\nThe plan.');
  });

  it('leaves notes untouched for a blank answer', () => {
    expect(appendToNotes('My notes.  ', '   \n', now)).toBe('My notes.  ');
  });
});
