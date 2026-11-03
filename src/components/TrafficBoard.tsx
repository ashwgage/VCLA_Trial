"use client";

import type { AreaSnapshot } from "@/lib/types";
import { displayName, fmtDuration, minsSince } from "@/lib/engine";
import { act } from "@/lib/actions";
import { LIGHT_STYLES, LightBadge, cx } from "./ui";

function waitText(s: AreaSnapshot) {
  if (s.attorneysHere === 0) return "—";
  if (s.estWaitNewMins === null) return "Not tonight";
  return s.estWaitNewMins <= 5 ? "No wait" : `~${fmtDuration(s.estWaitNewMins)}`;
}

/** Compact tiles for the Entrance and Front Desk: "can I let this person in?" at a glance. */
export function TrafficTiles({ snapshots }: { snapshots: AreaSnapshot[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {snapshots.map((s) => {
        const st = LIGHT_STYLES[s.light];
        return (
          <li key={s.area.id} className={cx("rounded-xl p-3", st.bg, st.text)} title={s.reason}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-bold">{s.area.short}</span>
              <span className="text-xs font-black tracking-wider">{st.word}</span>
            </div>
            <div className="mt-1 text-sm font-medium opacity-90">
              {s.attorneysHere} atty · {s.waiting.length + s.onDeck.length} in line
            </div>
            <div className="text-sm font-semibold">{waitText(s)}</div>
          </li>
        );
      })}
    </ul>
  );
}

function Dots({ n, className, label }: { n: number; className: string; label: string }) {
  const shown = Math.min(n, 12);
  return (
    <span className="inline-flex flex-wrap items-center gap-1" aria-label={`${n} ${label}`}>
      {Array.from({ length: shown }).map((_, i) => (
        <span key={i} className={cx("size-3 rounded-full", className)} />
      ))}
      {n > shown && <span className="text-xs font-semibold text-slate-600">+{n - shown}</span>}
    </span>
  );
}

/** The full nerve-center board: one row per practice area. */
export function TrafficRows({ snapshots, now }: { snapshots: AreaSnapshot[]; now: number }) {
  return (
    <ul className="space-y-2">
      {snapshots.map((s) => {
        const st = LIGHT_STYLES[s.light];
        const next = s.waiting[0];
        return (
          <li key={s.area.id} className={cx("overflow-hidden rounded-2xl bg-white ring-2", st.ring)}>
            <div className="flex flex-col sm:flex-row">
              <div className={cx("flex items-center justify-between gap-3 px-4 py-3 sm:w-56 sm:flex-col sm:items-start sm:justify-center", st.bg, st.text)}>
                <span className="text-lg font-bold leading-tight">{s.area.name}</span>
                <span className={cx("text-sm font-black tracking-wider", s.light === "red" && "animate-pulse")}>
                  {st.word} · {st.label}
                </span>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-3 px-4 py-3 md:grid-cols-4">
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">Attorneys here</div>
                  <div className="text-2xl font-bold tabular-nums">{s.attorneysHere}</div>
                  <div className="text-sm text-slate-600">
                    {s.attorneysFree} free · {s.attorneysBusy} with client
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">Clients in line</div>
                  <div className="text-2xl font-bold tabular-nums">{s.waiting.length + s.onDeck.length}</div>
                  <div className="text-sm text-slate-600">
                    {s.waiting.length} waiting · {s.onDeck.length} on deck
                  </div>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <div className="text-xs font-semibold uppercase text-slate-500">New client would wait</div>
                  <div className="text-xl font-bold">{waitText(s)}</div>
                  <div className="text-sm text-slate-600">{s.reason}</div>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <div className="text-xs font-semibold uppercase text-slate-500">Next in line</div>
                  {next ? (
                    <>
                      <div className="font-semibold">{next.description}</div>
                      <div className="text-sm text-slate-600">
                        {displayName(next)} · waiting {fmtDuration(minsSince(next.waitingAt, now))}
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-500">Nobody waiting</div>
                  )}
                </div>
                <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 md:col-span-4">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Dots n={s.attorneysHere} className="rounded-sm bg-blue-700" label="attorneys" /> attorneys
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Dots n={s.waiting.length + s.onDeck.length} className="bg-slate-500" label="clients" /> clients
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => act({ type: "area_override", practiceAreaId: s.area.id, closed: !s.closedByStaff }, "dashboard")}
                    className="rounded-lg px-2.5 py-1 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                  >
                    {s.closedByStaff ? "Reopen for tonight" : "Close for tonight"}
                  </button>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export { LightBadge };
