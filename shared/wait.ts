// How the panel, the fish and the notifications word why a session waits.
import type { Wait, WaitKind } from './types.ts';

export const WAIT_TAGS: Record<WaitKind, string> = { question: 'question', permission: 'permission', plan: 'plan' };

/** What the session is waiting for, e.g. "wants to run rm -rf dist"; null when the CLI didn't say. */
export const waitPhrase = (wait: Wait | undefined) => {
  if (!wait) return null;
  if (wait.kind === 'question') return 'asking you a question';
  if (wait.kind === 'plan') return 'plan ready for approval';
  return wait.detail ? `wants to ${wait.detail}` : 'needs your permission';
};
