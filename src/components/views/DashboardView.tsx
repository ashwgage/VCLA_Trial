"use client";

import { useMemo, useState } from "react";
import { AREA_BY_ID } from "@/lib/config";
import { allAreaSnapshots, avgSessionMins, displayName, fmtClock, fmtDuration, headCounts, minsSince, qaAlerts } from "@/lib/engine";
import { useNow } from "@/lib/useNow";
import type { Light } from "@/lib/types";
import { AlertsPanel } from "../AlertsPanel";
import { useOpenClinic } from "../ClinicGate";
import { TrafficRows } from "../TrafficBoard";
import { Card, LIGHT_STYLES, PageTitle, Stat, cx } from "../ui";

export function DashboardView() {
  const { clinic, state } = useOpenClinic();
  const now = useNow();
  const [hideQuiet, setHideQuiet] = useState(false);
  const snapshots = useMemo(() => allAreaSnapshots(state, now, clinic), [state, now, clinic]);
  const alerts = useMemo(() => qaAlerts(state, now, clinic), [state, now, clinic]);
  const counts = headCounts(state);
  const avg = avgSessionMins(state);
  const shown = hideQuiet ? snapshots.filter((s) => s.attorneysHere + s.waiting.length + s.onDeck.length + s.withAttorney.length > 0) : snapshots;
  const tally = snapshots.reduce<Record<Light, number>>((acc, s) => ({ ...acc, [s.light]: acc[s.light] + 1 }), { green: 0, yellow: 0, red: 0, none: 0 });

  // The waiting room, longest wait first, described the way staff will find people.
  const waitingRoom = Object.values(state.clients)
    .filter((c) => c.status === "waiting" || c.status === "arrived")
    .sort((a, b) => (a.waitingAt ?? a.arrivedAt) - (b.waitingAt ?? b.arrivedAt));
  const estStart = Object.assign({}, ...snapshots.map((s) => s.estStartById)) as Record<string, number | null>;

  return (
    <div>
      <PageTitle
        title="Live Dashboard"
        subtitle={
          <>
            Clinic night {clinic.date} · opened {fmtClock(clinic.openedAt)} · closes {fmtClock(clinic.closesAt)} · avg session{" "}
            {avg.mins} min{avg.fromTonight ? " (tonight)" : " (default)"}
          </>
        }
        right={
          <div className="flex flex-wrap gap-1.5 text-sm font-bold">
            {(["red", "yellow", "green"] as Light[]).map((l) => (
              <span key={l} className={cx("rounded-lg px-2.5 py-1", LIGHT_STYLES[l].bg, LIGHT_STYLES[l].text)}>
                {tally[l]} {LIGHT_STYLES[l].word}
              </span>
            ))}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="In waiting room" value={counts.inWaitingRoom} />
        <Stat label="With attorneys" value={counts.withAttorney} />
        <Stat label="Attorneys free" value={counts.attorneysFree} tone="text-green-700" />
        <Stat label="Attorneys busy" value={counts.attorneysBusy} tone="text-violet-700" />
        <Stat label="Done tonight" value={counts.done} />
        <Stat label="Left early" value={counts.left} tone="text-slate-500" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-bold">Practice areas</h2>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={hideQuiet} onChange={(e) => setHideQuiet(e.target.checked)} className="size-4" />
              Hide areas with no one
            </label>
          </div>
          <TrafficRows snapshots={shown} now={now} />
        </div>

        <div className="space-y-5">
          <Card>
            <h2 className="text-lg font-bold">Head count check</h2>
            <p className="mt-1 text-slate-700">
              There should be <strong>{counts.inWaitingRoom}</strong> {counts.inWaitingRoom === 1 ? "person" : "people"} in the waiting room (
              {counts.waiting} waiting, {counts.onDeck} filling out forms) and <strong>{counts.withAttorney}</strong> with attorneys.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {counts.total} checked in tonight = {counts.inBuilding} here + {counts.done} done + {counts.left} left.
            </p>
          </Card>
          <Card>
            <h2 className="mb-3 text-lg font-bold">Needs attention ({alerts.length})</h2>
            <AlertsPanel alerts={alerts} />
          </Card>
          <Card>
            <h2 className="mb-1 text-lg font-bold">Waiting room</h2>
            <p className="mb-3 text-sm text-slate-600">Longest wait first. Find people by description; don&apos;t call names.</p>
            {waitingRoom.length === 0 ? (
              <p className="text-slate-500">The waiting room is empty.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {waitingRoom.map((c) => {
                  const m = c.status === "waiting" ? minsSince(c.waitingAt, now) : minsSince(c.arrivedAt, now);
                  const start = estStart[c.id];
                  return (
                    <li key={c.id} className="flex items-start justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <span className="block font-semibold">{c.description}</span>
                        <span className="text-sm text-slate-600">
                          {displayName(c)} · {AREA_BY_ID[c.practiceAreaId].short}
                          {c.language !== "English" && ` · ${c.language}`}
                          {c.status === "arrived" && " · filling out form"}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className={cx("block font-bold tabular-nums", m >= 90 ? "text-red-700" : m >= 60 ? "text-amber-700" : "text-slate-800")}>
                          {fmtDuration(m)}
                        </span>
                        <span className="text-xs text-slate-500">
                          {start === undefined ? "" : start === null ? "may not be seen" : start <= now ? "up next" : `seen ~${fmtClock(start)}`}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
