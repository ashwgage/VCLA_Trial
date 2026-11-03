"use client";

import Link from "next/link";
import { useState } from "react";
import { THRESHOLDS } from "@/lib/config";
import { fmtClock, headCounts } from "@/lib/engine";
import { loadSampleNight, resetEverything, startClinic, useClinic } from "@/lib/store";
import { Button, Card, PageTitle } from "../ui";

const STATIONS = [
  { href: "/dashboard", icon: "📊", title: "Live Dashboard", who: "Nerve center & front desk", text: "Green / yellow / red per practice area, waiting room, and QA warnings." },
  { href: "/entrance", icon: "🚪", title: "Entrance", who: "Door volunteer", text: "Check clients in: name, legal issue, language, what they look like." },
  { href: "/nerve-center", icon: "🧭", title: "Nerve Center", who: "Orchestrator", text: "Forms turned in, attorney picked a client, session done, client left." },
  { href: "/front-desk", icon: "🧑‍⚖️", title: "Front Desk", who: "Front desk staff", text: "Check attorneys in and out; mark clients who leave." },
  { href: "/close-out", icon: "🔒", title: "Close Out", who: "End of night", text: "Account for everyone, then save the night." },
  { href: "/reports", icon: "📁", title: "Reports", who: "VCLA leadership", text: "Per-clinic and yearly history." },
];

export function HomeView() {
  const { ready, clinic, state } = useClinic();
  const [closeTime, setCloseTime] = useState(
    `${String(THRESHOLDS.defaultCloseHour).padStart(2, "0")}:${String(THRESHOLDS.defaultCloseMinute).padStart(2, "0")}`,
  );
  const [confirmReset, setConfirmReset] = useState(false);
  if (!ready) return <div className="py-20 text-center text-slate-500">Loading…</div>;
  const counts = headCounts(state);

  return (
    <div>
      <PageTitle title="Clinic Night" subtitle="Real-time queue for VCLA legal clinic nights. Pick your station." />

      {!clinic ? (
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <Card>
            <h2 className="text-lg font-bold">Start tonight&apos;s clinic</h2>
            <label className="mt-3 block">
              <span className="font-medium">Clinic closes at</span>
              <input
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="mt-1 block rounded-xl border-0 px-3 py-2 text-lg ring-1 ring-slate-300"
              />
            </label>
            <Button
              size="lg"
              className="mt-4"
              onClick={() => {
                const [h, m] = closeTime.split(":").map(Number);
                startClinic(h, m);
              }}
            >
              Open the clinic
            </Button>
          </Card>
          <Card className="bg-blue-50 ring-blue-200">
            <h2 className="text-lg font-bold">Just looking?</h2>
            <p className="mt-1 text-slate-700">Load a sample evening already in progress: ~30 clients, 9 attorneys, one overloaded line, and a few people the QA checks flag.</p>
            <Button size="lg" variant="secondary" className="mt-4" onClick={loadSampleNight}>
              Load sample night
            </Button>
          </Card>
        </div>
      ) : (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Clinic is open · {clinic.date}</h2>
              <p className="text-slate-600">
                Opened {fmtClock(clinic.openedAt)}, closes {fmtClock(clinic.closesAt)} · {counts.inBuilding} clients in the building ·{" "}
                {counts.attorneysPresent} attorneys here
              </p>
            </div>
            <Link href="/dashboard" className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800">
              Open dashboard →
            </Link>
          </div>
        </Card>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STATIONS.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="flex h-full gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 hover:ring-2 hover:ring-blue-500">
              <span className="text-3xl" aria-hidden>
                {s.icon}
              </span>
              <span>
                <span className="block text-lg font-bold">{s.title}</span>
                <span className="block text-sm font-medium text-blue-800">{s.who}</span>
                <span className="mt-1 block text-slate-600">{s.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Card className="mt-6 bg-slate-50">
        <h2 className="font-bold">Demo notes</h2>
        <p className="mt-1 text-sm text-slate-700">
          This demo stores data in this browser only. Open several stations in separate tabs or windows and they update each other live. Multi-device sync
          arrives with the hosted database (see README).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {clinic && (
            <Button variant="secondary" onClick={loadSampleNight}>
              Replace with sample night
            </Button>
          )}
          {!confirmReset ? (
            <Button variant="ghost" onClick={() => setConfirmReset(true)}>
              Reset all demo data…
            </Button>
          ) : (
            <span className="flex items-center gap-2">
              <span className="text-sm font-medium">Erase tonight and all history?</span>
              <Button
                variant="danger"
                onClick={() => {
                  resetEverything();
                  setConfirmReset(false);
                }}
              >
                Erase
              </Button>
              <Button variant="secondary" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}
