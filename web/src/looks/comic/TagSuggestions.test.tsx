// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TagSuggestion } from '../../api';
import { REASON_DELAY_MS } from '../../models/useSuggestionReason';
import { TagSuggestions } from './TagSuggestions';

/**
 * The Comic tag suggestions, pencilled in, with the reason in a thought bubble.
 * Same props, labels and timing as Classic's tray (they share useSuggestionReason).
 */

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
const bubble = () => screen.queryByRole('tooltip');
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('Comic TagSuggestions', () => {
  it('renders nothing without suggestions', () => {
    const { container } = renderTray([]);
    expect(container.innerHTML).toBe('');
  });

  it('pencils the suggestions into one dashed tray labelled suggested, with the hash and no probability', () => {
    renderTray([cooking, weekend]);
    const tray = screen.getByRole('group', { name: 'Suggested tags' });
    expect(tray.className).toContain('comic-suggest-tray');
    expect(tray.textContent).toMatch(/^suggested/i);
    expect(screen.getAllByRole('button', { name: /^Add the suggested tag / }).map((b) => b.textContent)).toEqual(['#cooking', '#weekend']);
    expect(screen.getByRole('button', { name: 'Dismiss the suggested tag weekend' }).textContent).toBe('×');
    expect(tray.textContent).not.toMatch(/0\.9|90|%/);
  });

  it('clicking the name inks it in and × rubs it out', () => {
    renderTray([cooking]);
    fireEvent.click(addButton('cooking'));
    expect(onAdd).toHaveBeenCalledWith('cooking');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss the suggested tag cooking' }));
    expect(onDismiss).toHaveBeenCalledWith('cooking');
  });

  it('ignores a suggestion while its Add or Dismiss is in flight, keeping focus on it', () => {
    const { rerender } = renderTray([cooking, weekend]);
    const add = addButton('cooking');
    act(() => add.focus());
    rerender(<TagSuggestions suggestions={[cooking, weekend]} onAdd={onAdd} onDismiss={onDismiss} busy="cooking" />);
    const dismiss = screen.getByRole('button', { name: 'Dismiss the suggested tag cooking' });
    expect(add.getAttribute('aria-disabled')).toBe('true');
    expect(dismiss.getAttribute('aria-disabled')).toBe('true');
    expect((add as HTMLButtonElement).disabled).toBe(false);
    expect(document.activeElement).toBe(add);
    fireEvent.click(add);
    fireEvent.click(dismiss);
    expect(onAdd).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
    expect(addButton('weekend').getAttribute('aria-disabled')).toBeNull();
  });

  it('thinks the reason in a bubble, only after hovering for a moment', async () => {
    renderTray([cooking]);
    expect(bubble()).toBeNull();

    fireEvent.mouseEnter(addButton('cooking'));
    await wait(REASON_DELAY_MS - 10);
    expect(bubble()).toBeNull();
    await wait(10);

    const why = bubble()!;
    expect(why.className).toContain('comic-thought');
    expect(why.textContent).toContain('Suggested because it reads like these nuggets tagged #cooking:');
    expect([...why.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['Recipe box', 'Pantry tracker']);
    expect(why.textContent).toContain('click to ink it in · × to rub it out');

    fireEvent.mouseLeave(addButton('cooking'));
    expect(bubble()).toBeNull();
  });

  it('leaving before the delay never shows the reason', async () => {
    renderTray([cooking]);
    fireEvent.mouseEnter(addButton('cooking'));
    await wait(REASON_DELAY_MS / 2);
    fireEvent.mouseLeave(addButton('cooking'));
    await wait(REASON_DELAY_MS);
    expect(bubble()).toBeNull();
  });

  it('describes the Add button with the reason, for screen readers', () => {
    renderTray([cooking]);
    const why = document.getElementById(addButton('cooking').getAttribute('aria-describedby') ?? '');
    expect(why?.getAttribute('role')).toBe('tooltip');
    expect(why?.textContent).toContain('tagged #cooking');
  });

  it('says "this nugget" for a single example, and names only the tag when there are none', async () => {
    renderTray([weekend, { tag: 'old', probability: 0.8, examples: [] }]);
    fireEvent.mouseEnter(addButton('weekend'));
    await wait(REASON_DELAY_MS);
    expect(bubble()!.textContent).toContain('reads like this nugget tagged #weekend:');
    fireEvent.mouseLeave(addButton('weekend'));

    fireEvent.mouseEnter(addButton('old'));
    await wait(REASON_DELAY_MS);
    expect(bubble()!.textContent).toContain('Suggested from nuggets already tagged #old');
    expect(bubble()!.querySelector('ul')).toBeNull();
  });

  it('shows the reason on keyboard focus too, and Escape closes it without moving focus', async () => {
    renderTray([cooking]);
    const add = addButton('cooking');
    act(() => add.focus());
    await wait(REASON_DELAY_MS);
    expect(bubble()).not.toBeNull();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(bubble()).toBeNull();
    expect(document.activeElement).toBe(add);
  });

  it('inks the chip up while it is engaged', async () => {
    renderTray([cooking]);
    const chip = addButton('cooking').parentElement!;
    expect(chip.className).not.toContain('comic-suggest-chip--inked');
    fireEvent.mouseEnter(addButton('cooking'));
    expect(chip.className).toContain('comic-suggest-chip--inked');
    fireEvent.mouseLeave(addButton('cooking'));
    expect(chip.className).not.toContain('comic-suggest-chip--inked');
  });

  it('opens leftwards near the right edge of the page', async () => {
    renderTray([cooking]);
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 800 });
    const add = addButton('cooking');
    const chip = add.parentElement!;
    vi.spyOn(chip, 'getBoundingClientRect').mockReturnValue({ left: 700, right: 790 } as DOMRect);
    fireEvent.mouseEnter(add);
    await wait(REASON_DELAY_MS);
    expect(bubble()!.dataset.side).toBe('left');

    fireEvent.mouseLeave(add);
    vi.spyOn(chip, 'getBoundingClientRect').mockReturnValue({ left: 20, right: 110 } as DOMRect);
    fireEvent.mouseEnter(add);
    await wait(REASON_DELAY_MS);
    expect(bubble()!.dataset.side).toBe('right');
  });
});
