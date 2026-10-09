// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TagSuggestions, REASON_DELAY_MS } from './TagSuggestions';
import type { TagSuggestion } from '../../api';

const cooking: TagSuggestion = { tag: 'cooking', probability: 0.9, examples: ['Recipe box', 'Pantry tracker'] };
const weekend: TagSuggestion = { tag: 'weekend', probability: 0.8, examples: ['Bike shed'] };

let onAdd: ReturnType<typeof vi.fn<(tag: string) => void>>;
let onDismiss: ReturnType<typeof vi.fn<(tag: string) => void>>;

beforeEach(() => {
  vi.useFakeTimers();
  onAdd = vi.fn<(tag: string) => void>();
  onDismiss = vi.fn<(tag: string) => void>();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const renderTray = (suggestions: TagSuggestion[], busy: string | null = null) =>
  render(<TagSuggestions suggestions={suggestions} onAdd={onAdd} onDismiss={onDismiss} busy={busy} />);

const addButton = (tag: string) => screen.getByRole('button', { name: `Add the suggested tag ${tag}` });
const tooltip = () => screen.queryByRole('tooltip');
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('TagSuggestions', () => {
  it('renders nothing without suggestions', () => {
    const { container } = renderTray([]);
    expect(container.innerHTML).toBe('');
  });

  it('groups the suggestions in one tray labelled suggested, in order', () => {
    renderTray([cooking, weekend]);
    const tray = screen.getByRole('group', { name: 'Suggested tags' });
    expect(tray.textContent).toMatch(/^suggested/);
    const adds = screen.getAllByRole('button', { name: /^Add the suggested tag / });
    expect(adds.map((b) => b.textContent)).toEqual(['cooking', 'weekend']);
    expect(screen.getByRole('button', { name: 'Dismiss the suggested tag weekend' }).textContent).toBe('×');
    expect(tray.textContent).not.toMatch(/0\.9|90|%/);
  });

  it('clicking the name adds and × dismisses', () => {
    renderTray([cooking]);
    fireEvent.click(addButton('cooking'));
    expect(onAdd).toHaveBeenCalledWith('cooking');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss the suggested tag cooking' }));
    expect(onDismiss).toHaveBeenCalledWith('cooking');
  });

  it('disables a suggestion while its Add or Dismiss is in flight', () => {
    renderTray([cooking, weekend], 'cooking');
    expect((addButton('cooking') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Dismiss the suggested tag cooking' }) as HTMLButtonElement).disabled).toBe(true);
    expect((addButton('weekend') as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows the reason only after hovering for a moment', async () => {
    renderTray([cooking]);
    expect(tooltip()).toBeNull();

    fireEvent.mouseEnter(addButton('cooking'));
    await wait(REASON_DELAY_MS - 10);
    expect(tooltip()).toBeNull();
    await wait(10);

    const why = tooltip()!;
    expect(why.textContent).toContain('Suggested because it reads like these nuggets tagged cooking:');
    expect(why.querySelector('b')?.textContent).toBe('cooking');
    expect([...why.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['Recipe box', 'Pantry tracker']);
    expect(why.textContent).toContain('click to add · × to dismiss');

    fireEvent.mouseLeave(addButton('cooking'));
    expect(tooltip()).toBeNull();
  });

  it('leaving before the delay never shows the reason', async () => {
    renderTray([cooking]);
    fireEvent.mouseEnter(addButton('cooking'));
    await wait(REASON_DELAY_MS / 2);
    fireEvent.mouseLeave(addButton('cooking'));
    await wait(REASON_DELAY_MS);
    expect(tooltip()).toBeNull();
  });

  it('describes the Add button with the reason', () => {
    renderTray([cooking]);
    const add = addButton('cooking');
    const why = document.getElementById(add.getAttribute('aria-describedby') ?? '');
    expect(why?.getAttribute('role')).toBe('tooltip');
    expect(why?.textContent).toContain('tagged cooking');
  });

  it('says "this nugget" for a single example', async () => {
    renderTray([weekend]);
    fireEvent.mouseEnter(addButton('weekend'));
    await wait(REASON_DELAY_MS);
    expect(tooltip()!.textContent).toContain('Suggested because it reads like this nugget tagged weekend:');
  });

  it('without stored examples, names only the tag', async () => {
    renderTray([{ tag: 'old', probability: 0.8, examples: [] }]);
    fireEvent.mouseEnter(addButton('old'));
    await wait(REASON_DELAY_MS);
    const why = tooltip()!;
    expect(why.textContent).toContain('Suggested from nuggets already tagged old');
    expect(why.textContent).not.toContain('reads like');
    expect(why.querySelector('ul')).toBeNull();
  });

  it('shows the reason on keyboard focus too, and keeps it moving between Add and ×', async () => {
    renderTray([cooking]);
    const add = addButton('cooking');
    const dismiss = screen.getByRole('button', { name: 'Dismiss the suggested tag cooking' });
    act(() => add.focus());
    await wait(REASON_DELAY_MS);
    expect(tooltip()).not.toBeNull();

    act(() => dismiss.focus());
    await wait(REASON_DELAY_MS);
    expect(tooltip()).not.toBeNull();

    act(() => dismiss.blur());
    expect(tooltip()).toBeNull();
  });

  it('Escape closes the reason without moving focus', async () => {
    renderTray([cooking]);
    const add = addButton('cooking');
    act(() => add.focus());
    await wait(REASON_DELAY_MS);
    expect(tooltip()).not.toBeNull();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(tooltip()).toBeNull();
    expect(document.activeElement).toBe(add);
  });

  it('opens leftwards near the right edge of the page', async () => {
    renderTray([cooking]);
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 800 });
    const add = addButton('cooking');
    const chip = add.parentElement!;
    vi.spyOn(chip, 'getBoundingClientRect').mockReturnValue({ left: 700, right: 790 } as DOMRect);
    fireEvent.mouseEnter(add);
    await wait(REASON_DELAY_MS);
    expect(tooltip()!.dataset.side).toBe('left');

    fireEvent.mouseLeave(add);
    vi.spyOn(chip, 'getBoundingClientRect').mockReturnValue({ left: 20, right: 110 } as DOMRect);
    fireEvent.mouseEnter(add);
    await wait(REASON_DELAY_MS);
    expect(tooltip()!.dataset.side).toBe('right');
  });
});
