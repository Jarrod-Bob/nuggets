// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusFilter } from './StatusFilter';

afterEach(cleanup);

describe('StatusFilter', () => {
  it('offers Done and filters to it', () => {
    const onChange = vi.fn();
    render(<StatusFilter onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onChange).toHaveBeenCalledWith('done');
  });
});
