import React from 'react';
import { api } from '../api';

/**
 * The two Looks (CONTEXT.md, ADR 0002). The server stamps the current one onto
 * <html data-look> as it serves the page; this is the only place the frontend
 * reads or writes that attribute.
 */
export type Look = 'classic' | 'comic';

export const LOOKS: readonly Look[] = ['classic', 'comic'];

export const isLook = (value: unknown): value is Look => value === 'classic' || value === 'comic';

/** The Look on <html>, or undefined when none was stamped (the Vite dev server). */
export function readLook(): Look | undefined {
  const value = document.documentElement.dataset.look;
  return isLook(value) ? value : undefined;
}

/** Switch every open page to this Look, now. */
export function applyLook(look: Look): void {
  document.documentElement.dataset.look = look;
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-look'] });
  return () => observer.disconnect();
}

/**
 * The Look to draw. When the page arrived without one (the Vite dev server
 * doesn't stamp it), `?look=` wins, else the saved Look is fetched; Classic
 * until it arrives.
 */
export function useLook(): Look {
  const look = React.useSyncExternalStore(subscribe, readLook);
  const stamped = look !== undefined;

  React.useEffect(() => {
    if (stamped) return;
    const asked = new URLSearchParams(window.location.search).get('look');
    if (isLook(asked)) {
      applyLook(asked);
      return;
    }
    let live = true;
    api.look
      .get()
      .then((s) => {
        if (live && readLook() === undefined) applyLook(isLook(s.look) ? s.look : 'classic');
      })
      .catch(() => {
        if (live && readLook() === undefined) applyLook('classic');
      });
    return () => {
      live = false;
    };
  }, [stamped]);

  return look ?? 'classic';
}

/** What a page draws per Look (elements, not components). Comic is optional: a view not drawn yet falls back to Classic. */
export type LookViews<C> = { classic: C; comic?: C };

export function viewFor<C>(look: Look, views: LookViews<C>): C {
  return views[look] ?? views.classic;
}
