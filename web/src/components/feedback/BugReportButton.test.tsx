// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Shell } from '../Shell';

afterEach(cleanup);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<p>bank</p>} />
          <Route path="/nuggets/:id" element={<p>nugget</p>} />
          <Route path="/trash" element={<p>trash</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('BugReportButton', () => {
  it.each(['/', '/nuggets/42', '/trash'])('is on %s, pre-filled with that route', (path) => {
    renderAt(path);
    const link = screen.getByRole('link', { name: /report a bug/i });
    const url = new URL(link.getAttribute('href')!);
    expect(url.origin + url.pathname).toBe('https://github.com/Jarrod-Bob/nuggets/issues/new');
    expect(url.searchParams.get('template')).toBe('bug_report.yml');
    expect(url.searchParams.get('page')).toBe(path);
    expect(url.searchParams.get('version')).toBe(__NUGGETS_BUILD__);
    expect(url.searchParams.get('browser')).toBe(navigator.userAgent);
  });

  it('opens in a new tab without handing GitHub a window reference', () => {
    renderAt('/');
    const link = screen.getByRole('link', { name: /report a bug/i });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('takes keyboard focus', () => {
    renderAt('/');
    const link = screen.getByRole('link', { name: /report a bug/i });
    link.focus();
    expect(document.activeElement).toBe(link);
  });
});
