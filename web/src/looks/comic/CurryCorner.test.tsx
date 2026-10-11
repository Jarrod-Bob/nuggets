// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CurryCorner } from './CurryCorner';

afterEach(cleanup);

const renderCorner = (onCardClick = vi.fn()) => {
  render(
    <div onClick={onCardClick}>
      <CurryCorner projectName="Ideanori" title="Nugget bank" shape={0} status="building" />
    </div>,
  );
  return { sauce: screen.getByRole('button', { name: 'Project name: Ideanori' }), onCardClick };
};

describe('the Comic curry corner', () => {
  it('carries the project name in its label and starts drained', () => {
    const { sauce } = renderCorner();
    expect(sauce.getAttribute('aria-expanded')).toBe('false');
  });

  it('previews while a mouse hovers it, and drains when the mouse leaves', () => {
    const { sauce } = renderCorner();
    fireEvent.pointerEnter(sauce, { pointerType: 'mouse' });
    expect(sauce.getAttribute('aria-expanded')).toBe('true');
    fireEvent.pointerLeave(sauce, { pointerType: 'mouse' });
    expect(sauce.getAttribute('aria-expanded')).toBe('false');
  });

  it('does not preview for a finger', () => {
    const { sauce } = renderCorner();
    fireEvent.pointerEnter(sauce, { pointerType: 'touch' });
    expect(sauce.getAttribute('aria-expanded')).toBe('false');
  });

  it('pins on a click, stays after the mouse leaves, and a second click drains it', () => {
    const { sauce } = renderCorner();
    fireEvent.pointerEnter(sauce, { pointerType: 'mouse' });
    fireEvent.click(sauce);
    fireEvent.pointerLeave(sauce, { pointerType: 'mouse' });
    expect(sauce.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(sauce);
    expect(sauce.getAttribute('aria-expanded')).toBe('false');
  });

  it('drains a pinned flood on Escape', () => {
    const { sauce } = renderCorner();
    fireEvent.click(sauce);
    fireEvent.keyDown(sauce, { key: 'Escape' });
    expect(sauce.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows the name and the title in the flood, hidden from assistive tech', () => {
    renderCorner();
    const name = screen.getByText('Ideanori');
    expect(name.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('keeps its clicks off the card behind it', () => {
    const { sauce, onCardClick } = renderCorner();
    fireEvent.click(sauce);
    expect(onCardClick).not.toHaveBeenCalled();
  });
});
