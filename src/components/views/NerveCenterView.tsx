"use client";

import { useMemo, useState } from "react";
import { AREA_BY_ID, LANGUAGES, PRACTICE_AREAS } from "@/lib/config";
import {
  activeClients,
  describeEvent,
  displayName,
  fmtClock,
  fmtDuration,
  minsSince,
  presentAttorneys,
  qaAlerts,
  queueFor,
} from "@/lib/engine";
import { act } from "@/lib/actions";
import { newId } from "@/lib/ids";
import { lastUndoable, undoLast } from "@/lib/store";
import { notify } from "@/lib/toast";
import { useNow } from "@/lib/useNow";
import type { AttorneyOnSite, Client, ClinicState } from "@/lib/types";
import { AlertsPanel } from "../AlertsPanel";
import { useOpenClinic } from "../ClinicGate";
import { AttorneyPicker, ClientPicker } from "../Pickers";
import { BigChoice, Button, Card, PageTitle, StepHeader, cx } from "../ui";

type Mode = "menu" | "form" | "match" | "finish" | "left" | "fix";

export function NerveCenterView() {
  const { clinic, state } = useOpenClinic();
  const now = useNow();
  const [mode, setMode] = useState<Mode>("menu");
  const [done, setDone] = useState<string | null>(null);
  const alerts = useMemo(() => qaAlerts(state, now, clinic), [state, now, clinic]);
  const active = activeClients(state);
  const finish = (msg: string) => {
    setDone(msg);
    setMode("menu");
  };
  const back = () => setMode("menu");

  const sessions = Object.values(state.sessions)
    .filter((s) => !s.endedAt)
    .sort((a, b) => a.startedAt - b.startedAt);

  return (
    <div>
      <PageTitle title="Nerve Center" subtitle="Record forms, matches and finished sessions. Attorneys choose their clients; you record it." />
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
                <BigChoice
                  icon="📄"
                  title="A client turned in their form"
                  hint={`They join the line for their practice area. ${active.filter((c) => c.status === "arrived").length} on deck.`}
                  onClick={() => setMode("form")}
                />
                <BigChoice
                  icon="🤝"
                  title="An attorney took a client's paper"
                  hint={`Starts the session timer. ${presentAttorneys(state).filter((a) => a.status === "available").length} attorneys free.`}
                  onClick={() => setMode("match")}
                />
                <BigChoice
                  icon="✅"
                  title="An attorney finished with a client"
                  hint={`Stops the timer and asks if they'll see another. ${sessions.length} in session.`}
                  onClick={() => setMode("finish")}
                />
                <BigChoice icon="🚌" title="A client is leaving" hint="They left early, e.g. to catch a bus." onClick={() => setMode("left")} />
                <BigChoice icon="↩️" tone="muted" title="Fix a mistake" hint="Undo the last action or change a client's details." onClick={() => setMode("fix")} />
              </div>
            </>
          )}
          {mode === "form" && <FormTurnedInFlow state={state} now={now} onBack={back} onDone={finish} />}
          {mode === "match" && <MatchFlow state={state} now={now} onBack={back} onDone={finish} />}
          {mode === "finish" && <FinishFlow state={state} now={now} onBack={back} onDone={finish} />}
          {mode === "left" && <ClientLeftFlow state={state} now={now} onBack={back} onDone={finish} station="nerve-center" />}
          {mode === "fix" && <FixFlow state={state} now={now} onBack={back} onDone={finish} />}
        </Card>

        <div className="space-y-5">
          <Card>
            <h2 className="mb-3 text-lg font-bold">Needs attention</h2>
            <AlertsPanel alerts={alerts} />
          </Card>
          <Card>
            <h2 className="mb-3 text-lg font-bold">With attorneys now</h2>
            {sessions.length === 0 ? (
              <p className="text-slate-500">No sessions running.</p>
            ) : (
              <ul className="space-y-2">
                {sessions.map((s) => {
                  const c = state.clients[s.clientId];
                  const a = state.attorneys[s.attorneyId];
                  const m = minsSince(s.startedAt, now);
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
                      <span className="min-w-0">
                        <span className="block font-semibold">{a?.name}</span>
                        <span className="text-sm text-slate-600">
                          {displayName(c)} · {c.description} · {AREA_BY_ID[c.practiceAreaId]?.short}
                        </span>
                      </span>
                      <span className={cx("shrink-0 font-bold tabular-nums", m >= 60 ? "text-red-700" : "text-slate-700")}>{fmtDuration(m)}</span>
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

type FlowProps = { state: ClinicState; now: number; onBack: () => void; onDone: (msg: string) => void };

/* ---------------- 1. Form turned in ---------------- */

function FormTurnedInFlow({ state, now, onBack, onDone }: FlowProps) {
  const [client, setClient] = useState<Client | null>(null);
  const [areaId, setAreaId] = useState<string>("");
  const onDeck = activeClients(state).filter((c) => c.status === "arrived");

  if (!client)
    return (
      <>
        <StepHeader step={1} total={2} title="Whose form is it?" onBack={onBack} />
        <ClientPicker
          clients={onDeck}
          now={now}
          onPick={(c) => {
            setClient(c);
            setAreaId(c.practiceAreaId);
          }}
          emptyText="Nobody is on deck. Check them in at the Entrance first."
        />
      </>
    );

  const linePos = queueFor(state, areaId).length + 1;
  const confirm = () => {
    if (areaId !== client.practiceAreaId && !act({ type: "client_updated", clientId: client.id, practiceAreaId: areaId }, "nerve-center")) return;
    if (act({ type: "form_turned_in", clientId: client.id }, "nerve-center"))
      onDone(`${displayName(client)} is #${linePos} in the ${AREA_BY_ID[areaId].short} line. Put the paper in the ${AREA_BY_ID[areaId].short.toUpperCase()} tray.`);
  };
  return (
    <>
      <StepHeader step={2} total={2} title={`Is this ${client.firstName} ${client.lastName}?`} onBack={() => setClient(null)} />
      <p className="text-lg">
        <strong>{client.description}</strong> · checked in {fmtDuration(minsSince(client.arrivedAt, now))} ago
      </p>
      <label className="mt-4 block">
        <span className="font-semibold">Practice area on the form</span>
        <select
          value={areaId}
          onChange={(e) => setAreaId(e.target.value)}
          className="mt-1 block w-full rounded-xl border-0 px-3 py-3 text-lg ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-600"
        >
          {PRACTICE_AREAS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {areaId !== client.practiceAreaId && (
          <span className="mt-1 block text-sm text-amber-800">Changing from {AREA_BY_ID[client.practiceAreaId].name}.</span>
        )}
      </label>
      <p className="mt-4 rounded-xl bg-blue-50 p-3 text-blue-950">
        They&apos;ll be <strong>#{linePos}</strong> in the {AREA_BY_ID[areaId].short} line. Put the paper in the <strong>{AREA_BY_ID[areaId].short}</strong> tray.
      </p>
      <div className="mt-6 flex justify-end">
        <Button size="lg" onClick={confirm}>
          ✓ Yes, they turned in their form
        </Button>
      </div>
    </>
  );
}

/* ---------------- 2. Attorney took a client ---------------- */

function MatchFlow({ state, now, onBack, onDone }: FlowProps) {
  const [attorney, setAttorney] = useState<AttorneyOnSite | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [showAll, setShowAll] = useState(false);
  const present = presentAttorneys(state);

  if (!attorney)
    return (
      <>
        <StepHeader step={1} total={3} title="Which attorney?" onBack={onBack} />
        <AttorneyPicker
          attorneys={present}
          now={now}
          onPick={setAttorney}
          isDisabled={(a) => (a.status === "in_session" ? `Still with ${displayName(state.clients[a.currentClientId!])}. Finish that first.` : null)}
          emptyText="No attorneys are checked in. Check them in at the Front Desk."
        />
      </>
    );

  // Waiting clients in this attorney's areas, first come first served. Attorneys still choose.
  const lines = attorney.practiceAreaIds.map((id) => ({ area: AREA_BY_ID[id], line: queueFor(state, id) }));
  const nextIds = new Set(lines.map((l) => l.line[0]?.id).filter(Boolean));
  const theirs = lines.flatMap((l) => l.line);
  const everyone = activeClients(state)
    .filter((c) => c.status === "waiting" || c.status === "arrived")
    .sort((a, b) => (a.waitingAt ?? a.arrivedAt + 1e12) - (b.waitingAt ?? b.arrivedAt + 1e12));
  const list = showAll ? everyone : theirs;

  if (!client)
    return (
      <>
        <StepHeader step={2} total={3} title={`Whose paper did ${attorney.name} take?`} onBack={() => setAttorney(null)} />
        <p className="mb-3 text-slate-600">
          Showing {showAll ? "everyone waiting" : `the ${attorney.practiceAreaIds.map((id) => AREA_BY_ID[id].short).join(" / ")} line`}, longest wait first.{" "}
          <button type="button" className="font-semibold text-blue-700 underline" onClick={() => setShowAll((x) => !x)}>
            {showAll ? "Only their practice areas" : "Show everyone"}
          </button>
        </p>
        <ClientPicker
          clients={list}
          now={now}
          onPick={setClient}
          emptyText="Nobody is waiting in their practice areas. Tap “Show everyone” to see other lines."
          badge={(c) =>
            nextIds.has(c.id) ? <span className="shrink-0 rounded-full bg-blue-700 px-2 py-0.5 text-xs font-bold text-white">Next in line</span> : null
          }
        />
      </>
    );

  const line = queueFor(state, client.practiceAreaId);
  const skipped = client.status === "waiting" ? line.findIndex((c) => c.id === client.id) : -1;
  const outsideArea = !attorney.practiceAreaIds.includes(client.practiceAreaId);
  const confirm = () => {
    if (act({ type: "session_started", sessionId: newId("s"), clientId: client.id, attorneyId: attorney.id }, "nerve-center"))
      onDone(`${attorney.name} is seeing ${displayName(client)} (${client.description}). Timer started.`);
  };
  return (
    <>
      <StepHeader step={3} total={3} title="Is this right?" onBack={() => setClient(null)} />
      <p className="text-xl">
        <strong>{attorney.name}</strong> is seeing <strong>{client.firstName} {client.lastName}</strong>
      </p>
      <p className="mt-1 text-slate-600">
        {client.description} · {AREA_BY_ID[client.practiceAreaId].name}
        {client.language !== "English" && ` · speaks ${client.language}`}
      </p>
      <div className="mt-4 space-y-2">
        {skipped > 0 && (
          <p className="rounded-xl bg-amber-50 p-3 text-amber-950 ring-1 ring-amber-200">
            {skipped} {skipped === 1 ? "person has" : "people have"} been waiting longer in this line. That&apos;s fine if the attorney chose this
            paper.
          </p>
        )}
        {client.status === "arrived" && (
          <p className="rounded-xl bg-amber-50 p-3 text-amber-950 ring-1 ring-amber-200">No form was recorded for them yet. We&apos;ll mark it turned in now.</p>
        )}
        {outsideArea && (
          <p className="rounded-xl bg-amber-50 p-3 text-amber-950 ring-1 ring-amber-200">
            {AREA_BY_ID[client.practiceAreaId].short} isn&apos;t one of {attorney.name}&apos;s listed practice areas.
          </p>
        )}
        {client.language === "Spanish" && !attorney.spanish && (
          <p className="rounded-xl bg-sky-50 p-3 text-sky-950 ring-1 ring-sky-200">The client speaks Spanish and this attorney doesn&apos;t. Line up a translator.</p>
        )}
      </div>
      <div className="mt-6 flex justify-end">
        <Button size="lg" onClick={confirm}>
          ✓ Start session
        </Button>
      </div>
    </>
  );
}

/* ---------------- 3. Session finished ---------------- */

function FinishFlow({ state, now, onBack, onDone }: FlowProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const open = Object.values(state.sessions)
    .filter((s) => !s.endedAt)
    .sort((a, b) => a.startedAt - b.startedAt);

  if (!sessionId)
    return (
      <>
        <StepHeader step={1} total={2} title="Who handed a paper back?" onBack={onBack} />
        {open.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-slate-600">No sessions are running.</p>
        ) : (
          <ul className="space-y-2">
            {open.map((s) => {
              const c = state.clients[s.clientId];
              const a = state.attorneys[s.attorneyId];
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSessionId(s.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl bg-white p-3 text-left ring-1 ring-slate-300 hover:bg-blue-50 hover:ring-blue-400"
                  >
                    <span>
                      <span className="block font-semibold">{a?.name}</span>
                      <span className="text-sm text-slate-600">
                        with {c.firstName} {c.lastName} · {c.description} · {AREA_BY_ID[c.practiceAreaId].short}
                      </span>
                    </span>
                    <span className="font-bold tabular-nums">{fmtDuration(minsSince(s.startedAt, now))}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </>
    );

  const s = state.sessions[sessionId];
  const a = state.attorneys[s.attorneyId];
  const c = state.clients[s.clientId];
  const end = (attorneyContinues: boolean) => {
    if (act({ type: "session_ended", sessionId, attorneyContinues }, "nerve-center"))
      onDone(
        `${displayName(c)} is done after ${fmtDuration(minsSince(s.startedAt, Date.now()))}. ${a.name} ${attorneyContinues ? "is back in the pool" : "is checked out. Thank them!"}`,
      );
  };
  return (
    <>
      <StepHeader step={2} total={2} title={`Does ${a.name} want to see another client?`} onBack={() => setSessionId(null)} />
      <p className="mb-5 text-slate-600">
        Finishing {c.firstName} {c.lastName} ({c.description}) after {fmtDuration(minsSince(s.startedAt, now))}.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <BigChoice icon="👍" title="Yes, another client" hint="Back in the pool" onClick={() => end(true)} />
        <BigChoice icon="👋" title="No, they're heading out" hint="Check them out" onClick={() => end(false)} />
      </div>
    </>
  );
}

/* ---------------- 4. Client left ---------------- */

export function ClientLeftFlow({ state, now, onBack, onDone, station }: FlowProps & { station: "nerve-center" | "front-desk" }) {
  const [client, setClient] = useState<Client | null>(null);
  if (!client)
    return (
      <>
        <StepHeader step={1} total={2} title="Who is leaving?" onBack={onBack} />
        <ClientPicker clients={activeClients(state)} now={now} onPick={setClient} emptyText="No clients are in the building." />
      </>
    );
  const confirm = () => {
    if (act({ type: "client_left", clientId: client.id }, station)) onDone(`${displayName(client)} is marked as left.`);
  };
  return (
    <>
      <StepHeader step={2} total={2} title={`Mark ${client.firstName} ${client.lastName} as left?`} onBack={() => setClient(null)} />
      <p className="text-lg">
        {client.description} · {AREA_BY_ID[client.practiceAreaId].name}
      </p>
      {client.status === "with_attorney" && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-amber-950 ring-1 ring-amber-200">
          They&apos;re with {state.attorneys[client.attorneyId!]?.name}. That session will end and the attorney goes back in the pool.
        </p>
      )}
      <p className="mt-3 text-slate-600">If they want to come back another night, let them know the next clinic date.</p>
      <div className="mt-6 flex justify-end">
        <Button size="lg" variant="danger" onClick={confirm}>
          Yes, they left
        </Button>
      </div>
    </>
  );
}

/* ---------------- 5. Fix a mistake ---------------- */

function FixFlow({ state, now, onBack, onDone }: FlowProps) {
  const { events } = useOpenClinic();
  const [editing, setEditing] = useState<Client | null>(null);
  const [draft, setDraft] = useState({ practiceAreaId: "", description: "", language: "" });
  const last = lastUndoable();
  const recent = events.slice(-8).reverse();

  if (editing)
    return (
      <>
        <StepHeader step={2} total={2} title={`Change ${editing.firstName} ${editing.lastName}`} onBack={() => setEditing(null)} />
        <div className="space-y-4">
          <label className="block">
            <span className="font-semibold">Practice area</span>
            <select
              value={draft.practiceAreaId}
              onChange={(e) => setDraft({ ...draft, practiceAreaId: e.target.value })}
              className="mt-1 block w-full rounded-xl border-0 px-3 py-3 text-lg ring-1 ring-slate-300"
            >
              {PRACTICE_AREAS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="font-semibold">Looks like</span>
            <input
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              className="mt-1 w-full rounded-xl border-0 px-4 py-3 text-lg ring-1 ring-slate-300"
            />
          </label>
          <label className="block">
            <span className="font-semibold">Language</span>
            <select
              value={draft.language}
              onChange={(e) => setDraft({ ...draft, language: e.target.value })}
              className="mt-1 block w-full rounded-xl border-0 px-3 py-3 text-lg ring-1 ring-slate-300"
            >
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-6 flex justify-end">
          <Button
            size="lg"
            onClick={() => {
              if (act({ type: "client_updated", clientId: editing.id, ...draft }, "nerve-center")) onDone(`Updated ${displayName(editing)}.`);
            }}
          >
            Save changes
          </Button>
        </div>
      </>
    );

  return (
    <>
      <StepHeader step={1} total={2} title="Fix a mistake" onBack={onBack} />
      <h3 className="font-semibold">Undo the last action</h3>
      {last ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
          <span>
            <span className="block font-medium">{describeEvent(last, state)}</span>
            <span className="text-sm text-slate-600">
              {fmtClock(last.at)} · {last.station}
            </span>
          </span>
          <Button
            variant="secondary"
            onClick={() => {
              const res = undoLast(last.id);
              if (res.ok) onDone(res.message);
              else notify({ tone: "error", message: res.error });
            }}
          >
            ↩ Undo this
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-slate-500">Nothing to undo.</p>
      )}

      <h3 className="mt-6 font-semibold">Change a client&apos;s details</h3>
      <p className="mb-2 text-sm text-slate-600">Wrong practice area or description? Pick the client.</p>
      <ClientPicker
        clients={activeClients(state)}
        now={now}
        onPick={(c) => {
          setEditing(c);
          setDraft({ practiceAreaId: c.practiceAreaId, description: c.description, language: c.language });
        }}
      />

      <h3 className="mt-6 font-semibold">Recent activity</h3>
      <ol className="mt-2 divide-y divide-slate-100 text-sm">
        {recent.map((e) => (
          <li key={e.id} className={cx("flex justify-between gap-3 py-1.5", e.undone && "text-slate-400 line-through")}>
            <span>{describeEvent(e, state)}</span>
            <span className="shrink-0 tabular-nums text-slate-500">{fmtClock(e.at)}</span>
          </li>
        ))}
      </ol>
    </>
  );
}
