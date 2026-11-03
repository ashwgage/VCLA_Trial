"use client";

import { useSyncExternalStore } from "react";

/**
 * One shared clock for the whole app. Re-renders subscribers every 10 seconds
 * so timers, wait estimates and QA alerts stay live. Returns 0 during the
 * server prerender (screens wait for local data before showing times anyway).
 */
const TICK_MS = 10_000;
let now = 0;
let timer: number | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === undefined) {
    timer = window.setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };
}

function getSnapshot() {
  // Refresh lazily if the cached value is stale (e.g. first read, or the tab was asleep).
  const t = Date.now();
  if (t - now >= TICK_MS) now = t;
  return now;
}

export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
