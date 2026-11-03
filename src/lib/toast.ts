"use client";

import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  tone: "success" | "error";
  message: string;
  /** If set, the toast offers Undo for this exact event. */
  undoEventId?: string;
}

let current: Toast | null = null;
let seq = 0;
let timer: number | undefined;
const listeners = new Set<() => void>();

export function notify(t: Omit<Toast, "id">, ms = 8000) {
  current = { ...t, id: ++seq };
  listeners.forEach((l) => l());
  window.clearTimeout(timer);
  timer = window.setTimeout(dismiss, ms);
}

export function dismiss() {
  current = null;
  listeners.forEach((l) => l());
}

export function useToast(): Toast | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
}
