import type { Transition } from 'motion/react';

/**
 * The house motion tokens from styles/tokens/motion.css, in the shape Motion
 * takes, so a Motion animation feels the same as a CSS one. Keep the two in
 * step. Reduced motion is handled once, by <MotionConfig reducedMotion="user">
 * in App, not per animation.
 */
export const dur = {
  instant: 0.08,
  fast: 0.14,
  base: 0.2,
  slow: 0.32,
  lazy: 0.52,
} as const;

export const ease = {
  out: [0.2, 0.8, 0.3, 1],
  inOut: [0.6, 0, 0.3, 1],
  /** The house easing: a small overshoot on anything that appears or is picked up. */
  bounce: [0.34, 1.56, 0.64, 1],
} as const satisfies Record<string, [number, number, number, number]>;

export const transitions = {
  appear: { duration: dur.slow, ease: ease.bounce },
  leave: { duration: dur.base, ease: ease.inOut },
} as const satisfies Record<string, Transition>;
