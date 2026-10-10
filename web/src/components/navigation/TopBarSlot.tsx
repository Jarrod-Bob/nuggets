import React from 'react';

/** What a top bar is given: the page's search box and its actions. */
export interface TopBarContent {
  center?: React.ReactNode;
  right?: React.ReactNode;
}

/**
 * Lets a Look's shell draw the top bar. Views hand their search and actions to
 * <TopBar>; with no slot provided it draws Classic's bar, otherwise the shell's
 * function draws the same content in its own frame (ADR 0002).
 */
export const TopBarSlot = React.createContext<((content: TopBarContent) => React.ReactNode) | null>(null);
