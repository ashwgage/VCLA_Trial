"use client";

import { useMemo, useState } from "react";
import { AREA_BY_ID, PRACTICE_AREAS } from "@/lib/config";
import { allAreaSnapshots, fmtClock, fmtDuration, minsSince, presentAttorneys } from "@/lib/engine";
import { act } from "@/lib/actions";
import { newId } from "@/lib/ids";
import { SAMPLE_ROSTER } from "@/lib/roster";
import { useNow } from "@/lib/useNow";
import type { AttorneyOnSite, RosterAttorney } from "@/lib/types";
import { useOpenClinic } from "../ClinicGate";
import { AreaChips, AttorneyPicker, RosterPicker, SpanishBadge } from "../Pickers";
import { TrafficTiles } from "../TrafficBoard";
import { BigChoice, Button, Card, PageTitle, StepHeader, cx } from "../ui";
import { ClientLeftFlow } from "./NerveCenterView";

type Mode = "menu" | "checkin" | "checkout" | "left";

export function FrontDeskView() {
  const { clinic, state } = useOpenClinic();
  const now = useNow();
  const [mode, setMode] = useState<Mode>("menu");
  const [done, setDone] = useState<string | null>(null);
  const snapshots = useMemo(() => allAreaSnapshots(state, now, clinic), [state, now, clinic]);
  const present = presentAttorneys(state);
  const finish = (msg: string) => {
    setDone(msg);
    setMode("menu");
  };
  const back = () => setMode("menu");

  return (
    <div>
      <PageTitle title="Front Desk" subtitle="Check attorneys in and out, and note clients who leave." />
      <div className="mb-5">
        <TrafficTiles snapshots={snapshots} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Card>
          {mode === "menu" && (
            <>
              {done && (
                <div className="mb-4 flex items-start justify-between gap-3 rounded-xl bg-green-50 p-4 text-green-950 ring-1 ring-green-200">
                  <span className="font-medium">✓ {done}</span>
                  <button type="button" className="text-sm font-semibold underline" onClick={() => setDone(null)}>
                    OK
                  </button>
                </div>
              )}
              <h2 className="mb-3 text-xl font-bold sm:text-2xl">What are you doing?</h2>
              <div className="space-y-3">
                <BigChoice icon="🧑‍⚖️" title="An attorney is arriving" hint="Pick them from the volunteer list." onClick={() => setMode("checkin")} />
                <BigChoice icon="👋" title="An attorney is leaving" hint="Check them out for the night." onClick={() => setMode("checkout")} />
                <BigChoice icon="🚌" title="A client is leaving" hint="They left early, e.g. to catch a bus." onClick={() => setMode("left")} />
              </div>
            </>
          )}
          {mode === "checkin" && <CheckInFlow presentIds={new Set(present.map((a) => a.id))} onBack={back} onDone={finish} />}
          {mode === "checkout" && <CheckOutFlow attorneys={present} now={now} onBack={back} onDone={finish} />}
          {mode === "left" && <ClientLeftFlow state={state} now={now} onBack={back} onDone={finish} station="front-desk" />}
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-bold">Attorneys here ({present.length})</h2>
          {present.length === 0 ? (
            <p className="text-slate-500">Nobody checked in yet.</p>
          ) : (
            <ul className="space-y-2">
              {present.map((a) => (
                <li key={a.id} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{a.name}</span>
                    <span
                      className={cx(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        a.status === "available" ? "bg-green-100 text-green-900" : "bg-violet-100 text-violet-900",
                      )}
                    >
                      {a.status === "available" ? "Free" : "With client"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <AreaChips ids={a.practiceAreaIds} />
                    {a.spanish && <SpanishBadge />}
                  </div>
                  <div className={cx("mt-1 text-xs", a.leaveBy && a.leaveBy < now ? "font-semibold text-red-700" : "text-slate-500")}>
                    Here {fmtDuration(minsSince(a.checkedInAt, now))}
                    {a.leaveBy && ` · leaving ${fmtClock(a.leaveBy)}`} · seen {a.clientsSeen}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

type FlowProps = { onBack: () => void; onDone: (msg: string) => void };

function leaveOptions(): { label: string; at: number }[] {
  // The next few half-hour marks, e.g. 7:00, 7:30, 8:00, 8:30.
  const out: { label: string; at: number }[] = [];
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
  for (let i = 0; i < 5; i++) {
    out.push({ label: fmtClock(d.getTime()), at: d.getTime() });
    d.setMinutes(d.getMinutes() + 30);
  }
  return out;
}

function CheckInFlow({ presentIds, onBack, onDone }: FlowProps & { presentIds: Set<string> }) {
  const [picked, setPicked] = useState<RosterAttorney | null>(null);
  const [walkIn, setWalkIn] = useState(false);
  const [name, setName] = useState("");
  const [areas, setAreas] = useState<string[]>([]);
  const [spanish, setSpanish] = useState(false);
  const [leaveBy, setLeaveBy] = useState<number | undefined>(undefined);
  const [options] = useState(leaveOptions);

  const choose = (r: RosterAttorney) => {
    setPicked(r);
    setName(r.name);
    setAreas(r.practiceAreaIds);
    setSpanish(r.spanish);
  };

  if (!picked && !walkIn)
    return (
      <>
        <StepHeader step={1} total={2} title="Who is arriving?" onBack={onBack} />
        <RosterPicker roster={SAMPLE_ROSTER} presentIds={presentIds} onPick={choose} />
        <button type="button" className="mt-4 font-semibold text-blue-700 underline" onClick={() => setWalkIn(true)}>
          Not on the list? Add a new volunteer
        </button>
      </>
    );

  const submit = () => {
    if (
      act(
        {
          type: "attorney_checked_in",
          attorneyId: picked?.id ?? newId("w"),
          name,
          practiceAreaIds: areas,
          spanish,
          leaveBy,
          walkIn: !picked,
        },
        "front-desk",
      )
    )
      onDone(`${name} is checked in${leaveBy ? ` until ${fmtClock(leaveBy)}` : ""}.`);
  };

  return (
    <>
      <StepHeader
        step={2}
        total={2}
        title={picked ? `Checking in ${picked.name}` : "New volunteer"}
        onBack={() => {
          setPicked(null);
          setWalkIn(false);
        }}
      />
      {!picked && (
        <label className="mb-4 block">
          <span className="font-semibold">Name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border-0 px-4 py-3 text-lg ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-600"
          />
        </label>
      )}
      <fieldset>
        <legend className="font-semibold">Practice areas tonight {picked && <span className="font-normal text-slate-500">(filled in from the list)</span>}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRACTICE_AREAS.map((a) => {
            const on = areas.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={on}
                onClick={() => setAreas((xs) => (on ? xs.filter((x) => x !== a.id) : [...xs, a.id]))}
                className={cx("rounded-xl px-3 py-2 font-medium ring-1", on ? "bg-blue-700 text-white ring-blue-700" : "bg-white ring-slate-300 hover:bg-slate-50")}
              >
                {a.short}
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="mt-4">
        <legend className="font-semibold">Speaks Spanish?</legend>
        <div className="mt-2 flex gap-2">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={spanish === v}
              onClick={() => setSpanish(v)}
              className={cx("rounded-xl px-4 py-2 font-medium ring-1", spanish === v ? "bg-blue-700 text-white ring-blue-700" : "bg-white ring-slate-300")}
            >
              {v ? "Yes" : "No"}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-4">
        <legend className="font-semibold">When do they need to leave? <span className="font-normal text-slate-500">(only if they say)</span></legend>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={leaveBy === undefined}
            onClick={() => setLeaveBy(undefined)}
            className={cx("rounded-xl px-3 py-2 font-medium ring-1", leaveBy === undefined ? "bg-blue-700 text-white ring-blue-700" : "bg-white ring-slate-300")}
          >
            Didn&apos;t say
          </button>
          {options.map((o) => (
            <button
              key={o.at}
              type="button"
              aria-pressed={leaveBy === o.at}
              onClick={() => setLeaveBy(o.at)}
              className={cx("rounded-xl px-3 py-2 font-medium ring-1", leaveBy === o.at ? "bg-blue-700 text-white ring-blue-700" : "bg-white ring-slate-300")}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="mt-6 flex justify-end">
        <Button size="lg" disabled={!name.trim() || areas.length === 0} onClick={submit}>
          ✓ Check in
        </Button>
      </div>
    </>
  );
}

function CheckOutFlow({ attorneys, now, onBack, onDone }: FlowProps & { attorneys: AttorneyOnSite[]; now: number }) {
  const [a, setA] = useState<AttorneyOnSite | null>(null);
  if (!a)
    return (
      <>
        <StepHeader step={1} total={2} title="Who is leaving?" onBack={onBack} />
        <AttorneyPicker
          attorneys={attorneys}
          now={now}
          onPick={setA}
          isDisabled={(x) => (x.status === "in_session" ? "Still with a client. Record that session as finished at the Nerve Center first." : null)}
          emptyText="No attorneys are checked in."
        />
      </>
    );
  return (
    <>
      <StepHeader step={2} total={2} title={`Check out ${a.name}?`} onBack={() => setA(null)} />
      <p className="text-lg">
        Saw {a.clientsSeen} client{a.clientsSeen === 1 ? "" : "s"} tonight in {a.practiceAreaIds.map((id) => AREA_BY_ID[id].short).join(", ")}.
      </p>
      <div className="mt-6 flex justify-end">
        <Button
          size="lg"
          onClick={() => {
            if (act({ type: "attorney_checked_out", attorneyId: a.id }, "front-desk")) onDone(`${a.name} is checked out. Thank them!`);
          }}
        >
          ✓ Check out
        </Button>
      </div>
    </>
  );
}
