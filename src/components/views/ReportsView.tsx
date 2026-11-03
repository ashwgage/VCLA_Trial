"use client";

import { useMemo, useState } from "react";
import { PRACTICE_AREAS } from "@/lib/config";
import { summarizeNight } from "@/lib/engine";
import { useClinic } from "@/lib/store";
import { useNow } from "@/lib/useNow";
import type { NightSummary } from "@/lib/types";
import { Button, Card, PageTitle, Stat } from "../ui";

function downloadCsv(nights: NightSummary[]) {
  const header = ["date", "checked_in", "served", "left_early", "attorneys", "avg_wait_min", "avg_session_min", ...PRACTICE_AREAS.map((a) => `served_${a.id}`)];
  const rows = nights.map((n) => [
    n.date,
    n.clientsCheckedIn,
    n.clientsServed,
    n.clientsLeft,
    n.attorneyIds.length,
    n.avgWaitMins ?? "",
    n.avgSessionMins ?? "",
    ...PRACTICE_AREAS.map((a) => n.byArea[a.id]?.served ?? 0),
  ]);
  const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "vcla-clinic-nights.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportsView() {
  const { ready, clinic, state, history } = useClinic();
  const now = useNow();
  const tonight = useMemo(() => (clinic ? summarizeNight(clinic, state, now) : null), [clinic, state, now]);
  const nights = useMemo(() => [...history].sort((a, b) => b.date.localeCompare(a.date)), [history]);
  const years = useMemo(() => {
    const ys = new Set(nights.map((n) => n.date.slice(0, 4)));
    if (tonight) ys.add(tonight.date.slice(0, 4));
    return [...ys].sort().reverse();
  }, [nights, tonight]);
  const [year, setYear] = useState<string>("");
  const activeYear = year || years[0] || (now ? String(new Date(now).getFullYear()) : "");

  if (!ready) return <div className="py-20 text-center text-slate-500">Loading…</div>;

  const inYear = nights.filter((n) => n.date.startsWith(activeYear));
  const attorneyNames = new Map<string, string>();
  inYear.forEach((n) => n.attorneyIds.forEach((id, i) => attorneyNames.set(id, n.attorneyNames[i])));
  const sum = (f: (n: NightSummary) => number) => inYear.reduce((t, n) => t + f(n), 0);
  const waits = inYear.map((n) => n.avgWaitMins).filter((x): x is number => x !== null);

  return (
    <div>
      <PageTitle
        title="Reports"
        subtitle="Per-clinic and yearly history. Closed nights are saved here automatically."
        right={
          <Button variant="secondary" disabled={nights.length === 0} onClick={() => downloadCsv(nights)}>
            ⬇ Download CSV
          </Button>
        }
      />

      {tonight && (
        <Card className="mb-5">
          <h2 className="text-lg font-bold">Tonight (in progress)</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="Checked in" value={tonight.clientsCheckedIn} />
            <Stat label="Seen" value={tonight.clientsServed} />
            <Stat label="Left early" value={tonight.clientsLeft} />
            <Stat label="Attorneys" value={tonight.attorneyIds.length} />
            <Stat label="Avg wait" value={tonight.avgWaitMins === null ? "—" : `${tonight.avgWaitMins}m`} />
          </div>
        </Card>
      )}

      <Card className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Year in review</h2>
          <select value={activeYear} onChange={(e) => setYear(e.target.value)} className="rounded-xl border-0 px-3 py-2 ring-1 ring-slate-300">
            {(years.length ? years : [activeYear]).map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label="Clinic nights" value={inYear.length} />
          <Stat label="Clients seen" value={sum((n) => n.clientsServed)} />
          <Stat label="Left early" value={sum((n) => n.clientsLeft)} />
          <Stat label="Attorneys volunteered" value={attorneyNames.size} />
          <Stat label="Avg wait" value={waits.length ? `${Math.round(waits.reduce((a, b) => a + b, 0) / waits.length)}m` : "—"} />
        </div>
        {inYear.length > 0 && (
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <h3 className="mb-2 font-semibold">Clients seen by practice area</h3>
              <ul className="space-y-1.5">
                {PRACTICE_AREAS.map((a) => {
                  const served = sum((n) => n.byArea[a.id]?.served ?? 0);
                  const max = Math.max(1, ...PRACTICE_AREAS.map((p) => sum((n) => n.byArea[p.id]?.served ?? 0)));
                  return (
                    <li key={a.id} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-2 text-sm">
                      <span className="truncate">{a.short}</span>
                      <span className="h-3 rounded-full bg-slate-100">
                        <span className="block h-3 rounded-full bg-blue-700" style={{ width: `${(served / max) * 100}%` }} />
                      </span>
                      <span className="text-right font-semibold tabular-nums">{served}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-semibold">Attorneys who volunteered in {activeYear}</h3>
              <ul className="columns-2 text-sm text-slate-700">
                {[...attorneyNames.values()].sort().map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-bold">Past clinic nights</h2>
        {nights.length === 0 ? (
          <p className="text-slate-500">No closed clinic nights yet. Close a night from the Close Out screen and it appears here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3 text-right">Checked in</th>
                  <th className="py-2 pr-3 text-right">Seen</th>
                  <th className="py-2 pr-3 text-right">Left early</th>
                  <th className="py-2 pr-3 text-right">Attorneys</th>
                  <th className="py-2 pr-3 text-right">Avg wait</th>
                  <th className="py-2 text-right">Avg session</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {nights.map((n) => (
                  <tr key={n.clinicId}>
                    <td className="py-2 pr-3 font-medium">{n.date}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{n.clientsCheckedIn}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{n.clientsServed}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{n.clientsLeft}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{n.attorneyIds.length}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{n.avgWaitMins ?? "—"}m</td>
                    <td className="py-2 text-right tabular-nums">{n.avgSessionMins ?? "—"}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
