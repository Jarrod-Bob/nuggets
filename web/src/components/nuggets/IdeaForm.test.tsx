// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdeaForm, type IdeaDraft } from './IdeaForm';
import type { KimiName } from '../../api';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const suggestion = (name: string): KimiName => ({ name, explanation: `why ${name}`, technique: 'portmanteau', tone: 'witty' });
const batch = (prefix: string) => [1, 2, 3, 4, 5].map((n) => suggestion(`${prefix}${n}`));

/** Whether GET /api/kimi/health says kimi is ready. */
let available: boolean;
/** Answers POST /api/kimi/names; by default five names per call, A1..A5 then B1..B5. */
let namesAnswer: (init: RequestInit) => Promise<Response>;
/** Bodies sent to POST /api/kimi/names. */
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

const generateButton = () => screen.getByRole('button', { name: /generate a creative name/i }) as HTMLButtonElement;
const titleInput = () => screen.getByLabelText('Title') as HTMLInputElement;
const projectNameInput = () => screen.getByLabelText(/^Suggested project name/) as HTMLInputElement;
const notesInput = () => screen.getByLabelText('Notes') as HTMLTextAreaElement;

/** Renders the form and waits for its health check to settle. */
async function renderForm(props: Partial<React.ComponentProps<typeof IdeaForm>> = {}) {
  const utils = render(<IdeaForm open {...props} />);
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/kimi/health', expect.anything()));
  await act(async () => {});
  return utils;
}

async function generate() {
  fireEvent.click(generateButton());
  await screen.findByText('A1');
}

describe('the generate button', () => {
  it('is disabled with a hint while the notes are empty', async () => {
    await renderForm();
    expect(generateButton().disabled).toBe(true);
    expect(screen.getByText('Write some notes and kimi will name it')).toBeTruthy();

    fireEvent.change(notesInput(), { target: { value: 'a bank for little ideas' } });
    expect(generateButton().disabled).toBe(false);
    expect(screen.queryByText('Write some notes and kimi will name it')).toBeNull();
  });

  it('is disabled and says so when kimi is unavailable', async () => {
    available = false;
    await renderForm({ idea: { notes: 'a bank for little ideas' } });
    expect(generateButton().disabled).toBe(true);
    expect(screen.getByText('kimi is not available at the moment')).toBeTruthy();
  });

  it('sends only the notes', async () => {
    await renderForm({ idea: { title: 'A title', notes: 'a bank for little ideas' } });
    await generate();
    expect(namesBodies).toEqual([{ notes: 'a bank for little ideas', avoid: [] }]);
    expect(screen.getAllByRole('option')).toHaveLength(5);
  });
});

describe('the suggestions', () => {
  it("show one name's explanation at a time, for the name under the pointer", async () => {
    await renderForm({ idea: { title: 'A title', notes: 'a bank for little ideas' } });
    await generate();
    expect(screen.queryByText(/^why A/)).toBeNull();

    fireEvent.mouseEnter(screen.getByText('A3'));
    expect(screen.getByText('why A3')).toBeTruthy();
    expect(screen.queryAllByText(/^why A/)).toHaveLength(1);

    fireEvent.mouseLeave(screen.getByText('A3'));
    expect(screen.queryByText(/^why A/)).toBeNull();
  });

  // jsdom has no layout: this checks the explanation line has one fixed size,
  // the rule that stops the form shifting as names are hovered in and out.
  it('keep the explanation line the same size whether or not a name is hovered', async () => {
    await renderForm({ idea: { title: 'A title', notes: 'a bank for little ideas' } });
    await generate();
    const line = screen.getByTestId('kimi-explanation');
    const empty = { height: line.style.height, lineHeight: line.style.lineHeight };
    expect(empty.height).not.toBe('');

    fireEvent.mouseEnter(screen.getByText('A3'));
    expect(screen.getByTestId('kimi-explanation')).toBe(line);
    expect({ height: line.style.height, lineHeight: line.style.lineHeight }).toEqual(empty);
  });

  it("keep the picked name's explanation once the pointer moves away", async () => {
    await renderForm({ idea: { title: 'A title', notes: 'a bank for little ideas' } });
    await generate();
    fireEvent.mouseEnter(screen.getByText('A2'));
    fireEvent.click(screen.getByText('A2'));
    fireEvent.mouseLeave(screen.getByText('A2'));
    expect(screen.getByText('why A2')).toBeTruthy();

    fireEvent.mouseEnter(screen.getByText('A5'));
    expect(screen.getByText('why A5')).toBeTruthy();
    expect(screen.queryByText('why A2')).toBeNull();
  });

  it("show the focused name's explanation, for keyboard users", async () => {
    await renderForm({ idea: { title: 'A title', notes: 'a bank for little ideas' } });
    await generate();
    fireEvent.focus(screen.getByText('A4'));
    expect(screen.getByText('why A4')).toBeTruthy();
    fireEvent.blur(screen.getByText('A4'));
    expect(screen.queryByText(/^why A/)).toBeNull();
  });
});

describe('picking a suggestion', () => {
  it('fills the project name and an empty title', async () => {
    await renderForm({ idea: { notes: 'a bank for little ideas' } });
    await generate();
    fireEvent.click(screen.getByText('A2'));
    expect(projectNameInput().value).toBe('A2');
    expect(titleInput().value).toBe('A2');
  });

  it('clears the missing-title error when it fills the title', async () => {
    await renderForm({ idea: { notes: 'a bank for little ideas' } });
    fireEvent.click(screen.getByRole('button', { name: 'Drop it in' }));
    expect(screen.getByText('A nugget needs a title.')).toBeTruthy();
    await generate();
    fireEvent.click(screen.getByText('A2'));
    expect(screen.queryByText('A nugget needs a title.')).toBeNull();
  });

  it('leaves a title that is already there', async () => {
    await renderForm({ idea: { title: 'Mine', notes: 'a bank for little ideas' } });
    await generate();
    fireEvent.click(screen.getByText('A2'));
    expect(projectNameInput().value).toBe('A2');
    expect(titleInput().value).toBe('Mine');
  });

  it("doesn't copy a typed project name into an empty title", async () => {
    const onSubmit = vi.fn();
    await renderForm({ onSubmit });
    fireEvent.change(projectNameInput(), { target: { value: 'Ideanori' } });
    fireEvent.click(screen.getByRole('button', { name: 'Drop it in' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('A nugget needs a title.')).toBeTruthy();
  });
});

describe('re-roll', () => {
  it('asks again avoiding every name shown so far', async () => {
    await renderForm({ idea: { notes: 'a bank for little ideas' } });
    await generate();
    fireEvent.click(screen.getByRole('button', { name: 'Re-roll' }));
    await screen.findByText('B1');
    fireEvent.click(screen.getByRole('button', { name: 'Re-roll' }));
    await waitFor(() => expect(namesBodies).toHaveLength(3));
    expect(namesBodies[1].avoid).toEqual(['A1', 'A2', 'A3', 'A4', 'A5']);
    expect(namesBodies[2].avoid).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'B1', 'B2', 'B3', 'B4', 'B5']);
  });
});

describe('while naming', () => {
  it('cancel aborts the request and the form stays editable', async () => {
    let signal: AbortSignal | undefined;
    namesAnswer = (init) =>
      new Promise((_, reject) => {
        signal = init.signal ?? undefined;
        signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    await renderForm({ idea: { notes: 'a bank for little ideas' } });
    fireEvent.click(generateButton());

    const cancel = await screen.findByRole('button', { name: 'Cancel naming' });
    fireEvent.change(titleInput(), { target: { value: 'Still typing' } });
    expect(titleInput().value).toBe('Still typing');

    fireEvent.click(cancel);
    expect(signal?.aborted).toBe(true);
    await waitFor(() => expect(generateButton().disabled).toBe(false));
    expect(screen.queryByText('kimi is not available at the moment')).toBeNull();
  });

  it('shows a busy ring on the button instead of a "Naming…" label', async () => {
    namesAnswer = () => new Promise(() => {});
    await renderForm({ idea: { notes: 'a bank for little ideas' } });
    fireEvent.click(generateButton());

    const cancel = await screen.findByRole('button', { name: 'Cancel naming' });
    expect(cancel.getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByText('Naming…')).toBeNull();
  });

  it('a failure says kimi is not available', async () => {
    namesAnswer = async () => json({ error: { message: 'kimi is not available at the moment.' } }, 502);
    await renderForm({ idea: { notes: 'a bank for little ideas' } });
    fireEvent.click(generateButton());
    expect(await screen.findByText('kimi is not available at the moment')).toBeTruthy();
  });

  it('kimi being off leaves the button for another try', async () => {
    namesAnswer = async () => json({ error: { message: 'kimi is not available at the moment.' } }, 503);
    await renderForm({ idea: { notes: 'a bank for little ideas' } });
    fireEvent.click(generateButton());
    await screen.findByText('kimi is not available at the moment');
    expect(generateButton().disabled).toBe(false);
    expect(screen.queryByText(/model couldn't run/)).toBeNull();
  });

  it("says when kimi's model couldn't run, and stops offering kimi for the rest of the form", async () => {
    namesAnswer = async () =>
      json({ error: { message: "kimi's model couldn't run; check Ollama on the GPU machine.", code: 'kimi_model_error' } }, 502);
    await renderForm({ idea: { notes: 'a bank for little ideas' } });
    fireEvent.click(generateButton());

    expect(await screen.findByText("kimi's model couldn't run; check Ollama on the GPU machine")).toBeTruthy();
    expect(screen.queryByText('kimi is not available at the moment')).toBeNull();
    expect(generateButton().disabled).toBe(true);

    // Editing the notes doesn't bring it back: every try would wait again.
    fireEvent.change(notesInput(), { target: { value: 'a bank for big ideas' } });
    expect(generateButton().disabled).toBe(true);
    expect(namesBodies).toHaveLength(1);
  });

  it("a Re-roll that hits kimi's model failing replaces the names and stops offering kimi", async () => {
    let call = 0;
    namesAnswer = async () =>
      call++ === 0
        ? json({ names: batch('A') })
        : json({ error: { message: 'secret', code: 'kimi_model_error' } }, 502);
    await renderForm({ idea: { notes: 'a bank for little ideas' } });
    await generate();

    fireEvent.click(screen.getByRole('button', { name: 'Re-roll' }));
    expect(await screen.findByText("kimi's model couldn't run; check Ollama on the GPU machine")).toBeTruthy();
    expect(screen.queryByText('A1')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Re-roll' })).toBeNull();
    expect(generateButton().disabled).toBe(true);
  });
});

describe('saving', () => {
  it('submits the project name, and changing it makes the form dirty', async () => {
    const onSubmit = vi.fn<(draft: IdeaDraft) => void>();
    const onDirtyChange = vi.fn();
    await renderForm({ mode: 'edit', idea: { title: 'Mine', project_name: 'Old' }, onSubmit, onDirtyChange });
    expect(projectNameInput().value).toBe('Old');
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    fireEvent.change(projectNameInput(), { target: { value: '  Ideanori ' } });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit.mock.calls[0][0].project_name).toBe('Ideanori');
  });
});
