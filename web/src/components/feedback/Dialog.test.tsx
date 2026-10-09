// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Dialog } from './Dialog';

afterEach(cleanup);

// jsdom has no layout, so these check the rules that keep a tall dialog on
// screen rather than measuring pixels.
describe('a dialog taller than the window', () => {
  function renderTall() {
    render(
      <Dialog open title="Drop a nugget" onClose={() => {}} footer={<button>Drop it in</button>}>
        <p>Body content</p>
      </Dialog>,
    );
    const body = screen.getByText('Body content').parentElement as HTMLElement;
    const panel = screen.getByRole('heading', { name: 'Drop a nugget' }).closest('div[style*="max-height"]') as HTMLElement | null;
    return { body, panel };
  }

  it('is capped at the window height', () => {
    const { panel } = renderTall();
    expect(panel).not.toBeNull();
    expect(panel!.style.maxHeight).toMatch(/100d?vh/);
  });

  it('scrolls its body while the title and buttons stay put', () => {
    const { body } = renderTall();
    expect(body.style.overflowY).toBe('auto');
    expect(body.contains(screen.getByRole('heading', { name: 'Drop a nugget' }))).toBe(false);
    expect(body.contains(screen.getByRole('button', { name: 'Drop it in' }))).toBe(false);
  });
});
