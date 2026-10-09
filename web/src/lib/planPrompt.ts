import type { Idea } from '../api';
import { statusLabel } from './status';

/**
 * "Plan with Claude" (issue #16a, phase 1): nuggets builds a planning prompt
 * from one nugget and hands it to Claude, either through a deep link or the
 * clipboard. No LLM is called from nuggets itself.
 *
 * THE PROMPT TEMPLATE. Edit the wording here; each {{placeholder}} is filled
 * from the nugget by buildPlanPrompt below. An empty field renders as the
 * "(none)" text in EMPTY so Claude knows it was left blank on purpose, except
 * the project name: a line holding {{project_name}} is left out entirely when
 * the nugget has none.
 */
export const PLAN_PROMPT_TEMPLATE = `I keep a bank of side-project ideas I call "nuggets". Help me turn this one into a plan I can start building.

## The idea

Title: {{title}}
Working name: {{project_name}}
Status: {{status}}
Tags: {{tags}}

Notes:
{{notes}}

Links:
{{links}}

## What I'd like from you

1. Restate the problem this solves and who it is for, in two or three sentences. If something important is unclear, ask me up to three clarifying questions before going further.
2. Propose an MVP scope: the smallest version worth building, and what to leave out for now.
3. Suggest a stack, with a sentence on why each piece fits this idea.
4. Give me the first three to five concrete steps, each small enough to start today.
5. List the main risks or unknowns, and a cheap way to check each one.

Keep it concise and practical, and use headings so I can paste your answer back into my notes.`;

const EMPTY = { tags: '(none)', notes: '(none yet)', links: '(none)' };

/** Appended to notes cut short to fit the deep link. */
export const NOTES_TRIMMED_MARKER = '\n\n[Notes trimmed to fit the link; ask me for the rest if you need it.]';

/**
 * Claude Desktop truncates `q` at "roughly 14,000 characters"
 * (https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link).
 * Stay well under it so the cut is ours, made in the notes, never Claude's
 * mid-instruction.
 */
export const DEEP_LINK_PROMPT_LIMIT = 12_000;

/**
 * Claude Desktop's documented new-chat link. The prompt lands in the composer
 * prefilled but not sent.
 */
export function claudeDesktopUrl(prompt: string): string {
  return `claude://claude.ai/new?q=${encodeURIComponent(prompt)}`;
}

/**
 * claude.ai in the browser. Its `?q=` prefill isn't documented (and was
 * reported removed in October 2025), so the web route is copy, then paste here.
 */
export const CLAUDE_WEB_NEW_CHAT_URL = 'https://claude.ai/new';

type PromptIdea = Pick<Idea, 'title' | 'notes' | 'tags' | 'status' | 'links'> & Partial<Pick<Idea, 'project_name'>>;

function render(idea: PromptIdea, notes: string): string {
  const projectName = (idea.project_name ?? '').trim();
  const fields: Record<string, string> = {
    title: idea.title.trim(),
    project_name: projectName,
    status: statusLabel(idea.status),
    tags: idea.tags.length ? idea.tags.join(', ') : EMPTY.tags,
    notes: notes.trim() ? notes.trim() : EMPTY.notes,
    links: idea.links.length
      ? idea.links.map((l) => (l.label.trim() ? `- ${l.label.trim()}: ${l.url}` : `- ${l.url}`)).join('\n')
      : EMPTY.links,
  };
  // A replacer function, so a `$&` typed into a nugget is inserted literally.
  const template = projectName
    ? PLAN_PROMPT_TEMPLATE
    : PLAN_PROMPT_TEMPLATE.split('\n').filter((line) => !line.includes('{{project_name}}')).join('\n');
  return template.replace(/\{\{(\w+)\}\}/g, (whole, key: string) => fields[key] ?? whole);
}

/** The complete prompt for a nugget — what Copy puts on the clipboard. */
export function buildPlanPrompt(idea: PromptIdea): string {
  return render(idea, idea.notes);
}

/** Cuts to at most `max` UTF-16 units without splitting a surrogate pair. */
function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  const end = max > 0 && /[\uD800-\uDBFF]/.test(text[max - 1]) ? max - 1 : max;
  return text.slice(0, Math.max(0, end));
}

/**
 * The prompt for the deep link: the full prompt when it fits in `limit`,
 * otherwise one whose notes are trimmed (and marked as trimmed) so the whole
 * prompt fits. `trimmed` tells the page to say the copied prompt is complete.
 */
export function buildDeepLinkPrompt(idea: PromptIdea, limit: number = DEEP_LINK_PROMPT_LIMIT): { prompt: string; trimmed: boolean } {
  const full = buildPlanPrompt(idea);
  if (full.length <= limit) return { prompt: full, trimmed: false };

  const notes = idea.notes.trim();
  // Everything but the kept part of the notes: the template, the other fields, the marker.
  // Measured behind a placeholder note so render's trim keeps the marker's leading newlines.
  const overhead = render(idea, `.${NOTES_TRIMMED_MARKER}`).length - 1;
  const kept = cut(notes, limit - overhead).trimEnd();
  const prompt = render(idea, kept + NOTES_TRIMMED_MARKER);
  // Only an enormous title or link list still overflows; cut the tail rather than send nothing.
  return { prompt: cut(prompt, limit), trimmed: true };
}

/** Local calendar date as YYYY-MM-DD, for the heading over a saved answer. */
function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Notes with Claude's answer appended under a dated heading. Existing notes are
 * kept exactly, apart from trailing whitespace before the new section; a blank
 * answer leaves them untouched.
 */
export function appendToNotes(existing: string, answer: string, now: Date = new Date()): string {
  const body = answer.trim();
  if (!body) return existing;
  const section = `Plan with Claude (${isoDate(now)}):\n${body}`;
  return existing.trim() ? `${existing.trimEnd()}\n\n${section}` : section;
}
