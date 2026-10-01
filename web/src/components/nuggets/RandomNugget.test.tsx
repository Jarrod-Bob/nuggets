// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RandomNugget, type RandomIdea } from './RandomNugget';

afterEach(cleanup);

/** Every roll returns `roll.value`, so a test steers each pick by setting it. */
const roll = { value: 0 };
const rng = () => roll.value;

const ideas: RandomIdea[] = [{ title: 'First idea' }, { title: 'Second idea' }];

function renderDraw() {
  let drawn = 0;
  render(<RandomNugget onDraw={() => ideas[drawn++ % ideas.length]} rng={rng} />);
  roll.value = 0;
  fireEvent.click(screen.getByText('Draw a nugget'));
}

const timebox = () => screen.getByTestId('challenge-timebox').textContent;
const stack = () => screen.getByTestId('challenge-stack').textContent;

describe('RandomNugget challenge', () => {
  it('deals a timebox, a stack with its track, and the data stamp alongside the nugget', () => {
    renderDraw();
    expect(screen.getByText('First idea')).toBeTruthy();
    expect(timebox()).toBe('90 minutes');
    expect(stack()).toBe('JavaScript + Express');
    expect(screen.getByText('Web · backend')).toBeTruthy();
    expect(screen.getByText('data: Stack Overflow 2025')).toBeTruthy();
  });

  it('rerolls the timebox without touching the stack or the nugget', () => {
    renderDraw();
    roll.value = 0.999;
    fireEvent.click(screen.getByText('Reroll timebox'));
    expect(timebox()).toBe('A weekend');
    expect(stack()).toBe('JavaScript + Express');
    expect(screen.getByText('First idea')).toBeTruthy();
  });

  it('rerolls the stack without touching the timebox or the nugget', () => {
    renderDraw();
    roll.value = 0.999;
    fireEvent.click(screen.getByText('Reroll stack'));
    expect(stack()).toBe('Elixir + Phoenix');
    expect(screen.getByText('Web · full-stack')).toBeTruthy();
    expect(timebox()).toBe('90 minutes');
    expect(screen.getByText('First idea')).toBeTruthy();
  });

  it('never rerolls the timebox or the stack onto what is already showing', () => {
    renderDraw();
    for (let n = 0; n < 4; n++) {
      const [shownTimebox, shownStack] = [timebox(), stack()];
      fireEvent.click(screen.getByText('Reroll timebox'));
      fireEvent.click(screen.getByText('Reroll stack'));
      expect(timebox()).not.toBe(shownTimebox);
      expect(stack()).not.toBe(shownStack);
    }
  });

  it('rerolls the nugget without touching the challenge', () => {
    renderDraw();
    roll.value = 0.999;
    fireEvent.click(screen.getByText('Reroll nugget'));
    expect(screen.getByText('Second idea')).toBeTruthy();
    expect(timebox()).toBe('90 minutes');
    expect(stack()).toBe('JavaScript + Express');
  });

  it('shows no challenge when there is nothing to draw', () => {
    render(<RandomNugget onDraw={() => null} rng={rng} />);
    fireEvent.click(screen.getByText('Draw a nugget'));
    expect(screen.getByText('Nothing to draw')).toBeTruthy();
    expect(screen.queryByTestId('challenge-timebox')).toBeNull();
  });
});
