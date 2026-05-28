// Tiny in-process pub/sub for SSE. One channel per run.
// Survives across requests in a single Next dev server because module state
// is cached per worker. For a real port we'd back this with Redis or a DB
// LISTEN/NOTIFY.

import 'server-only';
import type { RunEvent } from './types';

type Listener = (e: RunEvent) => void;

const listeners = new Map<string, Set<Listener>>();

export function subscribe(runId: string, fn: Listener): () => void {
  let set = listeners.get(runId);
  if (!set) {
    set = new Set();
    listeners.set(runId, set);
  }
  set.add(fn);
  return () => {
    set?.delete(fn);
    if (set && set.size === 0) listeners.delete(runId);
  };
}

export function publish(runId: string, event: RunEvent): void {
  const set = listeners.get(runId);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(event);
    } catch {
      // listener errors must not stop others
    }
  }
}
