"use client";

import { useMemo, useState } from "react";
import { AREA_BY_ID, LANGUAGES, PRACTICE_AREAS } from "@/lib/config";
import { activeClients, allAreaSnapshots, areaSnapshot, displayName, fmtDuration, minsSince } from "@/lib/engine";
import { act } from "@/lib/actions";
import { newId } from "@/lib/ids";
import { useNow } from "@/lib/useNow";
import { useOpenClinic } from "../ClinicGate";
import { TrafficTiles } from "../TrafficBoard";
import { Button, Card, LIGHT_STYLES, PageTitle, StatusPill, StepHeader, cx } from "../ui";

type Draft = { areaId: string; firstName: string; lastName: string; language: string; description: string };
const EMPTY: Draft = { areaId: "", firstName: "", lastName: "", language: "English", description: "" };

const DESCRIPTION_IDEAS = ["red sweater", "baseball cap", "black hoodie", "glasses", "with a child", "backpack", "denim jacket", "walker / cane"];

export function EntranceView() {
  const { clinic, state } = useOpenClinic();
  const now = useNow();
  const snapshots = useMemo(() => allAreaSnapshots(state, now, clinic), [state, now, clinic]);
  const [step, setStep] = useState(1);
  const [d, setD] = useState<Draft>(EMPTY);
  const [doneMsg, setDoneMsg] = useState<{ name: string; area: string; expect: string } | null>(null);

  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const area = d.areaId ? AREA_BY_ID[d.areaId] : undefined;
  const areaSnap = area ? snapshots.find((s) => s.area.id === area.id) : undefined;
  const dupes = useMemo(
    () =>
      d.firstName.trim() && d.lastName.trim()
        ? Object.values(state.clients).filter(
            (c) =>
              c.firstName.toLowerCase() === d.firstName.trim().toLowerCase() &&
              c.lastName.toLowerCase().startsWith(d.lastName.trim().toLowerCase().charAt(0)),
          )
        : [],
    [d.firstName, d.lastName, state.clients],
  );
  const arrivals = activeClients(state)
    .filter((c) => c.status === "arrived")
    .sort((a, b) => b.arrivedAt - a.arrivedAt);

  function expectation(areaId: string) {
    const s = areaSnapshot(state, AREA_BY_ID[areaId], now, clinic);
    const pos = s.waiting.length + s.onDeck.length;
    if (s.attorneysHere === 0) return `No ${s.area.short} attorney has checked in yet. Let the nerve center know.`;
    if (s.estWaitNewMins === null) return `They may not be seen before closing tonight.`;
    const wait = s.estWaitNewMins <= 5 ? "little to no wait" : `about ${fmtDuration(s.estWaitNewMins)}`;
    return `${pos === 0 ? "First" : `#${pos}`} in the ${s.area.short} line, ${s.attorneysHere} attorney${s.attorneysHere === 1 ? "" : "s"} here: expect ${wait}.`;
  }

  function submit() {
    const ok = act(
      {
        type: "client_checked_in",
        clientId: newId("cl"),
        firstName: d.firstName,
        lastName: d.lastName,
        practiceAreaId: d.areaId,
        language: d.language,
        description: d.description,
      },
      "entrance",
    );
    if (ok) {
      setDoneMsg({ name: displayName(d), area: AREA_BY_ID[d.areaId].name, expect: expectation(d.areaId) });
      setD(EMPTY);
      setStep(1);
    }
  }

  return (
    <div>
      <PageTitle title="Entrance" subtitle="Check clients in as they walk through the door. Eligibility is screened before this step." />
      <div className="mb-5">
        <TrafficTiles snapshots={snapshots} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          {doneMsg ? (
            <div className="py-6 text-center">
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-green-100 text-3xl text-green-700">✓</div>
              <h2 className="mt-3 text-2xl font-bold">{doneMsg.name} is checked in</h2>
              <p className="mt-1 text-slate-600">{doneMsg.area}</p>
              <p className="mx-auto mt-4 max-w-md rounded-xl bg-blue-50 p-4 text-left text-blue-950">
                <strong>Hand them an intake form.</strong> Tell them: {doneMsg.expect}
              </p>
              <Button size="lg" className="mt-6" onClick={() => setDoneMsg(null)}>
                Check in the next client
              </Button>
            </div>
          ) : step === 1 ? (
            <>
              <StepHeader step={1} total={4} title="What kind of legal issue?" />
              <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {PRACTICE_AREAS.map((a) => {
                  const s = snapshots.find((x) => x.area.id === a.id)!;
                  const st = LIGHT_STYLES[s.light];
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => {
                          set({ areaId: a.id });
                          setStep(2);
                        }}
                        className={cx(
                          "flex h-full w-full flex-col items-start rounded-xl bg-white p-3 text-left ring-2 hover:bg-slate-50",
                          d.areaId === a.id ? "ring-blue-600" : "ring-slate-200",
                        )}
                      >
                        <span className="flex w-full items-center justify-between gap-2">
                          <span className="font-semibold">{a.name}</span>
                          <span className={cx("size-3.5 shrink-0 rounded-full", st.bg)} aria-label={st.word} />
                        </span>
                        <span className="text-sm text-slate-600">{s.reason}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : step === 2 ? (
            <>
              <StepHeader step={2} total={4} title="Client's name" onBack={() => setStep(1)} />
              {areaSnap?.light === "red" && (
                <p className="mb-4 rounded-xl bg-red-50 p-3 font-medium text-red-900 ring-1 ring-red-200">
                  {area?.short} is <strong>RED</strong>: {areaSnap.reason.toLowerCase()}. Check with the nerve center before letting them in.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="font-semibold">First name</span>
                  <input
                    autoFocus
                    value={d.firstName}
                    onChange={(e) => set({ firstName: e.target.value })}
                    className="mt-1 w-full rounded-xl border-0 px-4 py-3 text-lg ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-600"
                    autoComplete="off"
                  />
                </label>
                <label className="block">
                  <span className="font-semibold">Last name</span>
                  <input
                    value={d.lastName}
                    onChange={(e) => set({ lastName: e.target.value })}
                    className="mt-1 w-full rounded-xl border-0 px-4 py-3 text-lg ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-600"
                    autoComplete="off"
                  />
                </label>
              </div>
              <fieldset className="mt-4">
                <legend className="font-semibold">Language</legend>
                <div className="mt-1 flex flex-wrap gap-2">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => set({ language: l })}
                      aria-pressed={d.language === l}
                      className={cx(
                        "rounded-xl px-3 py-2 font-medium ring-1",
                        d.language === l ? "bg-blue-700 text-white ring-blue-700" : "bg-white ring-slate-300 hover:bg-slate-50",
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </fieldset>
              {dupes.length > 0 && (
                <p className="mt-4 rounded-xl bg-amber-50 p-3 text-amber-950 ring-1 ring-amber-200">
                  Heads up: {dupes.map((c) => `${c.firstName} ${c.lastName} (${c.description})`).join(", ")} is already checked in tonight. Make sure this
                  isn&apos;t the same person.
                </p>
              )}
              <div className="mt-6 flex justify-end">
                <Button size="lg" disabled={!d.firstName.trim() || !d.lastName.trim()} onClick={() => setStep(3)}>
                  Next
                </Button>
              </div>
            </>
          ) : step === 3 ? (
            <>
              <StepHeader step={3} total={4} title="What do they look like?" onBack={() => setStep(2)} />
              <p className="mb-2 text-slate-600">Names aren&apos;t called out in the room. Staff find clients by this description.</p>
              <input
                autoFocus
                value={d.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="e.g. red sweater, Dodgers cap"
                className="w-full rounded-xl border-0 px-4 py-3 text-lg ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-600"
                autoComplete="off"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {DESCRIPTION_IDEAS.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => set({ description: d.description.trim() ? `${d.description.trim()}, ${idea}` : idea })}
                    className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium hover:bg-slate-200"
                  >
                    + {idea}
                  </button>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <Button size="lg" disabled={!d.description.trim()} onClick={() => setStep(4)}>
                  Next
                </Button>
              </div>
            </>
          ) : (
            <>
              <StepHeader step={4} total={4} title="Is this right?" onBack={() => setStep(3)} />
              <dl className="divide-y divide-slate-200 rounded-xl ring-1 ring-slate-200">
                {[
                  ["Name", `${d.firstName} ${d.lastName}`, 2],
                  ["Legal issue", area?.name, 1],
                  ["Language", d.language, 2],
                  ["Looks like", d.description, 3],
                ].map(([k, v, s]) => (
                  <div key={k as string} className="flex items-center gap-3 px-4 py-3">
                    <dt className="w-28 shrink-0 text-sm font-semibold text-slate-500">{k}</dt>
                    <dd className="flex-1 text-lg font-medium">{v}</dd>
                    <button type="button" onClick={() => setStep(s as number)} className="text-sm font-semibold text-blue-700 hover:underline">
                      Change
                    </button>
                  </div>
                ))}
              </dl>
              <p className="mt-4 rounded-xl bg-blue-50 p-3 text-blue-950">{expectation(d.areaId)}</p>
              <div className="mt-6 flex justify-end">
                <Button size="lg" onClick={submit}>
                  ✓ Check them in
                </Button>
              </div>
            </>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-bold">Walking in now</h2>
          <p className="mb-3 text-sm text-slate-600">Checked in, form not turned in yet (&ldquo;on deck&rdquo;).</p>
          {arrivals.length === 0 ? (
            <p className="text-slate-500">Nobody on deck.</p>
          ) : (
            <ul className="space-y-2">
              {arrivals.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-2 rounded-xl bg-slate-50 p-3">
                  <span>
                    <span className="block font-semibold">{c.description}</span>
                    <span className="text-sm text-slate-600">
                      {displayName(c)} · {AREA_BY_ID[c.practiceAreaId]?.short} · {fmtDuration(minsSince(c.arrivedAt, now))} ago
                    </span>
                  </span>
                  <StatusPill status={c.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
