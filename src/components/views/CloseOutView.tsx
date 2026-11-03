"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AREA_BY_ID } from "@/lib/config";
import { activeClients, fmtDuration, headCounts, minsSince, presentAttorneys } from "@/lib/engine";
import { act } from "@/lib/actions";
import { closeClinic } from "@/lib/store";
import { useNow } from "@/lib/useNow";
import { useOpenClinic } from "../ClinicGate";
import { Button, Card, PageTitle, StatusPill } from "../ui";

export function CloseOutView() {
  const { state } = useOpenClinic();
  const router = useRouter();
  const now = useNow();
  const [confirming, setConfirming] = useState(false);
  const clients = activeClients(state);
  const attorneys = presentAttorneys(state);
  const counts = headCounts(state);
  const clear = clients.length === 0 && attorneys.length === 0;

  return (
    <div>
      <PageTitle title="Close Out" subtitle="Nobody leaves the system unaccounted for. Resolve everyone below, then close the night." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-1 text-lg font-bold">Clients still open ({clients.length})</h2>
          <p className="mb-3 text-sm text-slate-600">Each one must end as Done or Left.</p>
          {clients.length === 0 ? (
            <p className="rounded-xl bg-green-50 px-4 py-3 font-medium text-green-900">✓ Every client is accounted for.</p>
          ) : (
            <ul className="space-y-2">
              {clients.map((c) => {
                const session = Object.values(state.sessions).find((s) => s.clientId === c.id && !s.endedAt);
                return (
                  <li key={c.id} className="rounded-xl bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span>
                        <span className="block font-semibold">
                          {c.firstName} {c.lastName} · {c.description}
                        </span>
                        <span className="text-sm text-slate-600">
                          {AREA_BY_ID[c.practiceAreaId].short} · checked in {fmtDuration(minsSince(c.arrivedAt, now))} ago
                          {session && ` · with ${state.attorneys[session.attorneyId]?.name}`}
                        </span>
                      </span>
                      <StatusPill status={c.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {session && (
                        <Button variant="secondary" onClick={() => act({ type: "session_ended", sessionId: session.id, attorneyContinues: true }, "nerve-center")}>
                          Session finished
                        </Button>
                      )}
                      <Button variant="secondary" onClick={() => act({ type: "client_left", clientId: c.id }, "nerve-center")}>
                        {c.status === "with_attorney" ? "Left mid-session" : "Left / not seen"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <h2 className="mb-1 text-lg font-bold">Attorneys still checked in ({attorneys.length})</h2>
            {attorneys.length === 0 ? (
              <p className="mt-2 rounded-xl bg-green-50 px-4 py-3 font-medium text-green-900">✓ Every attorney is checked out.</p>
            ) : (
              <>
                <ul className="mt-3 space-y-2">
                  {attorneys.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
                      <span>
                        <span className="block font-semibold">{a.name}</span>
                        <span className="text-sm text-slate-600">
                          {a.status === "in_session" ? "Still with a client" : "Free"} · saw {a.clientsSeen}
                        </span>
                      </span>
                      <Button
                        variant="secondary"
                        disabled={a.status === "in_session"}
                        onClick={() => act({ type: "attorney_checked_out", attorneyId: a.id }, "front-desk")}
                      >
                        Check out
                      </Button>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="ghost"
                  className="mt-3"
                  disabled={!attorneys.some((a) => a.status === "available")}
                  onClick={() =>
                    attorneys.filter((a) => a.status === "available").forEach((a) => act({ type: "attorney_checked_out", attorneyId: a.id }, "front-desk"))
                  }
                >
                  Check out everyone who is free
                </Button>
              </>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-bold">Tonight so far</h2>
            <p className="mt-1 text-slate-700">
              {counts.total} clients checked in · {counts.done} seen · {counts.left} left early · {Object.keys(state.attorneys).length} attorneys
              volunteered.
            </p>
            {!confirming ? (
              <Button size="lg" className="mt-4 w-full" disabled={!clear} onClick={() => setConfirming(true)}>
                {clear ? "Close the clinic for tonight" : `Resolve ${clients.length + attorneys.length} open item${clients.length + attorneys.length === 1 ? "" : "s"} first`}
              </Button>
            ) : (
              <div className="mt-4 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
                <p className="font-medium text-amber-950">Close tonight&apos;s clinic? The night is saved to Reports and every station resets.</p>
                <div className="mt-3 flex gap-2">
                  <Button
                    onClick={() => {
                      closeClinic();
                      router.push("/reports");
                    }}
                  >
                    Yes, close and save
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
