// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdeaDialog } from './IdeaDialog';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const names = ['A1', 'A2', 'A3', 'A4', 'A5'].map((name) => ({ name, explanation: `why ${name}`, technique: 'portmanteau', tone: 'witty' }));

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string) => Promise.resolve(path === '/api/kimi/health' ? json({ available: true }) : json({ names }))),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('IdeaDialog project name', () => {
  it('uses the sticker field: names come back as stickers beside a dice pill', async () => {
    render(<IdeaDialog open mode="create" />);
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'A tool for naming things.' } });

    const generate = screen.getByRole('button', { name: /Uses kimi-no-name-wa/ }) as HTMLButtonElement;
    await waitFor(() => expect(generate.disabled).toBe(false));
    expect(generate.classList.contains('comic-dice')).toBe(true);
    fireEvent.click(generate);

    expect(await screen.findAllByRole('option')).toHaveLength(5);
  });
});
