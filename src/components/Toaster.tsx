"use client";

import { undoLast } from "@/lib/store";
import { dismiss, notify, useToast } from "@/lib/toast";
import { cx } from "./ui";

export function Toaster() {
  const t = useToast();
  if (!t) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4" aria-live="polite">
      <div
        key={t.id}
        role="status"
        className={cx(
          "pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-2xl px-4 py-3 shadow-lg",
          t.tone === "success" ? "bg-slate-900 text-white" : "bg-red-700 text-white",
        )}
      >
        <span aria-hidden className="text-lg">{t.tone === "success" ? "✓" : "!"}</span>
        <span className="min-w-0 flex-1 font-medium">{t.message}</span>
        {t.undoEventId && (
          <button
            type="button"
            className="rounded-lg bg-white/15 px-3 py-1.5 font-semibold hover:bg-white/25"
            onClick={() => {
              const res = undoLast(t.undoEventId);
              notify(res.ok ? { tone: "success", message: res.message } : { tone: "error", message: res.error });
            }}
          >
            Undo
          </button>
        )}
        <button type="button" aria-label="Dismiss" className="rounded-lg px-2 py-1 hover:bg-white/15" onClick={dismiss}>
          ✕
        </button>
      </div>
    </div>
  );
}
