// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KimiName } from '../../api';
import { ProjectNameField } from './ProjectNameField';

/**
 * The Comic project-name field: a dice pill, kimi's names as tilted stickers,
 * the picked one in curry with a check, and a fixed two-line "why" box. Driven
 * by useKimiNames (the same model Classic's field uses), so the same labels
 * and accessible names hold.
 */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const suggestion = (name: string): KimiName => ({ name, explanation: `why ${name}`, technique: 'portmanteau', tone: 'witty' });
const batch = (prefix: string) => [1, 2, 3, 4, 5].map((n) => suggestion(`${prefix}${n}`));

let available: boolean;
let namesAnswer: (init: RequestInit) => Promise<Response>;
let namesBodies: Array<{ notes: string; avoid: string[] }>;

beforeEach(() => {
  available = true;
  namesBodies = [];
  let call = 0;
  namesAnswer = async () => json({ names: batch(call++ === 0 ? 'A' : 'B') });
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/kimi/health') return Promise.resolve(json({ available }));
      if (path === '/api/kimi/names') {
        namesBodies.push(JSON.parse(String(init?.body)));
        return namesAnswer(init ?? {});
      }
      return Promise.reject(new Error(`unexpected fetch ${path}`));
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The field as the form holds it: the form owns the value, and a pick fills it. */
function Harness({ notes }: { notes: string }) {
  const [value, setValue] = React.useState('');
  return <ProjectNameField value={value} onChange={setValue} notes={notes} onPick={setValue} />;
}

async function renderField(notes = 'a bank for little ideas') {
  const utils = render(<Harness notes={notes} />);
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/kimi/health', expect.anything()));
  await act(async () => {});
  return utils;
}

const rollButton = () => screen.getByRole('button', { name: /generate a creative name/i }) as HTMLButtonElement;
const input = () => screen.getByLabelText(/^Suggested project name/) as HTMLInputElement;

async function roll() {
  fireEvent.click(rollButton());
  await screen.findByText('A1');
}

describe('the dice pill', () => {
  it('is disabled with a literal hint while the notes are empty', async () => {
    await renderField('');
    expect(rollButton().disabled).toBe(true);
    expect(rollButton().textContent).toBe('Roll names');
    expect(screen.getByText('Write some notes and kimi will name it')).toBeTruthy();
  });

  it('is disabled and says so when kimi is down', async () => {
    available = false;
    await renderField();
    expect(rollButton().disabled).toBe(true);
    expect(screen.getByText('kimi is not available at the moment')).toBeTruthy();
  });

  it('sends only the notes and lays five names out as stickers', async () => {
    await renderField();
    await roll();
    expect(namesBodies).toEqual([{ notes: 'a bank for little ideas', avoid: [] }]);
    const list = screen.getByRole('listbox', { name: 'Names from kimi' });
    const stickers = within(list).getAllByRole('option');
    expect(stickers).toHaveLength(5);
    expect(stickers[0].className).toContain('comic-sticker');
    // No sparkle emoji: the dice is the generator's mark.
    expect(document.body.textContent).not.toContain('✨');
  });
});

describe('the stickers', () => {
  it("explain one name at a time in a box that is always two lines tall", async () => {
    await renderField();
    await roll();
    const box = screen.getByTestId('kimi-explanation');
    expect(box.style.height).not.toBe('');
    expect(box.textContent).toBe('');

    fireEvent.mouseEnter(screen.getByText('A3'));
    expect(screen.getByTestId('kimi-explanation').textContent).toBe('why A3');
    expect(screen.getByTestId('kimi-explanation')).toBe(box);
    fireEvent.mouseLeave(screen.getByText('A3'));
    expect(box.textContent).toBe('');
  });

  it("explain the focused name for keyboard users", async () => {
    await renderField();
    await roll();
    fireEvent.focus(screen.getByText('A4'));
    expect(screen.getByTestId('kimi-explanation').textContent).toBe('why A4');
  });

  it('turn the picked name curry with a check, fill the field, and keep its explanation', async () => {
    await renderField();
    await roll();
    const sticker = screen.getByText('A2').closest('[role="option"]')!;
    expect(sticker.getAttribute('aria-selected')).toBe('false');
    fireEvent.click(sticker);

    expect(input().value).toBe('A2');
    expect(sticker.getAttribute('aria-selected')).toBe('true');
    expect(sticker.className).toContain('comic-sticker--picked');
    expect(sticker.querySelector('svg')).toBeTruthy();
    expect(screen.getByTestId('kimi-explanation').textContent).toBe('why A2');
    expect(screen.getByText('A1').closest('[role="option"]')!.className).not.toContain('comic-sticker--picked');
  });

  it('can be picked with Enter', async () => {
    await renderField();
    await roll();
    fireEvent.keyDown(screen.getByText('A5').closest('[role="option"]')!, { key: 'Enter' });
    expect(input().value).toBe('A5');
  });
});

describe('re-rolling', () => {
  it('asks again, avoiding every name shown so far', async () => {
    await renderField();
    await roll();
    // The one dice pill now reads Re-roll.
    fireEvent.click(screen.getByRole('button', { name: 'Re-roll' }));
    await screen.findByText('B1');
    expect(namesBodies[1].avoid).toEqual(['A1', 'A2', 'A3', 'A4', 'A5']);
  });
});

describe('rolling', () => {
  it('turns the pill into Stop, which cancels and keeps the field editable', async () => {
    let signal: AbortSignal | undefined;
    namesAnswer = (init) =>
      new Promise((_, reject) => {
        signal = init.signal ?? undefined;
        signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    await renderField();
    fireEvent.click(rollButton());

    const stop = await screen.findByRole('button', { name: 'Cancel naming' });
    expect(stop.textContent).toBe('Stop');
    expect(stop.getAttribute('aria-busy')).toBe('true');
    fireEvent.change(input(), { target: { value: 'Still typing' } });
    expect(input().value).toBe('Still typing');

    fireEvent.click(stop);
    expect(signal?.aborted).toBe(true);
    await waitFor(() => expect(rollButton().disabled).toBe(false));
    expect(screen.queryByText('kimi is not available at the moment')).toBeNull();
  });

  it('says kimi is not available when the request fails', async () => {
    namesAnswer = async () => json({ error: { message: 'kimi is not available at the moment.' } }, 502);
    await renderField();
    fireEvent.click(rollButton());
    expect((await screen.findByRole('status')).textContent).toBe('kimi is not available at the moment');
  });
});
