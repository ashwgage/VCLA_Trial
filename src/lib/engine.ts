/**
 * Pure clinic logic: replay events into state, validate new events, and
 * compute the live per-practice-area picture and QA/QC alerts.
 *
 * Everything here is framework-free and deterministic (time is passed in), so
 * it can run unchanged on the server once a real backend is added.
 */
import { AREA_BY_ID, PRACTICE_AREAS, THRESHOLDS } from "./config";
import type {
  AreaSnapshot,
  AttorneyOnSite,
  Client,
  ClinicEvent,
  ClinicState,
  EventBody,
  Light,
  NightSummary,
  PracticeArea,
  QaAlert,
  Clinic,
} from "./types";

const MIN = 60_000;

export function emptyState(): ClinicState {
  return { clients: {}, clientOrder: [], attorneys: {}, sessions: {}, closedAreas: {} };
}

/* ------------------------------------------------------------------ */
/* Validation: the "idiot-proof" layer. Invalid actions never land.    */
/* ------------------------------------------------------------------ */

export function validate(state: ClinicState, e: EventBody): string | null {
  switch (e.type) {
    case "client_checked_in": {
      if (!e.firstName.trim()) return "Enter the client's first name.";
      if (!e.lastName.trim()) return "Enter the client's last name (an initial is fine).";
      if (!AREA_BY_ID[e.practiceAreaId]) return "Pick a practice area.";
      if (!e.description.trim()) return "Describe what they look like so staff can find them.";
      return null;
    }
    case "form_turned_in": {
      const c = state.clients[e.clientId];
      if (!c) return "That client isn't checked in.";
      if (c.status !== "arrived") return `${displayName(c)} is already ${statusLabel(c.status).toLowerCase()}.`;
      return null;
    }
    case "session_started": {
      const c = state.clients[e.clientId];
      const a = state.attorneys[e.attorneyId];
      if (!c) return "That client isn't checked in.";
      if (c.status !== "waiting" && c.status !== "arrived")
        return `${displayName(c)} is ${statusLabel(c.status).toLowerCase()}, not waiting.`;
      if (!a || a.status === "checked_out") return "That attorney isn't checked in.";
      if (a.status === "in_session") return `${a.name} is already with a client.`;
      return null;
    }
    case "session_ended": {
      const s = state.sessions[e.sessionId];
      if (!s) return "Session not found.";
      if (s.endedAt) return "That session already ended.";
      return null;
    }
    case "client_left": {
      const c = state.clients[e.clientId];
      if (!c) return "That client isn't checked in.";
      if (c.status === "done" || c.status === "left") return `${displayName(c)} is already ${statusLabel(c.status).toLowerCase()}.`;
      return null;
    }
    case "client_updated": {
      const c = state.clients[e.clientId];
      if (!c) return "That client isn't checked in.";
      if (e.practiceAreaId && !AREA_BY_ID[e.practiceAreaId]) return "Unknown practice area.";
      if (e.description !== undefined && !e.description.trim()) return "Description can't be empty.";
      return null;
    }
    case "attorney_checked_in": {
      const a = state.attorneys[e.attorneyId];
      if (a && a.status !== "checked_out") return `${a.name} is already checked in.`;
      if (!e.name.trim()) return "Enter the attorney's name.";
      if (e.practiceAreaIds.length === 0) return "Pick at least one practice area.";
      return null;
    }
    case "attorney_checked_out": {
      const a = state.attorneys[e.attorneyId];
      if (!a || a.status === "checked_out") return "That attorney isn't checked in.";
      if (a.status === "in_session")
        return `${a.name} is still with a client. Finish that session first.`;
      return null;
    }
    case "area_override":
      return AREA_BY_ID[e.practiceAreaId] ? null : "Unknown practice area.";
  }
}

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

function endSession(s: ClinicState, sessionId: string, at: number, outcome: "done" | "client_left", attorneyContinues: boolean) {
  const session = s.sessions[sessionId];
  if (!session || session.endedAt) return;
  s.sessions[sessionId] = { ...session, endedAt: at, outcome };
  const a = s.attorneys[session.attorneyId];
  if (a) {
    s.attorneys[a.id] = {
      ...a,
      status: attorneyContinues ? "available" : "checked_out",
      checkedOutAt: attorneyContinues ? a.checkedOutAt : at,
      currentClientId: undefined,
      currentSessionId: undefined,
      clientsSeen: a.clientsSeen + 1,
    };
  }
}

export function apply(state: ClinicState, ev: ClinicEvent): ClinicState {
  if (ev.undone || validate(state, ev)) return state;
  const s: ClinicState = {
    clients: { ...state.clients },
    clientOrder: state.clientOrder,
    attorneys: { ...state.attorneys },
    sessions: { ...state.sessions },
    closedAreas: state.closedAreas,
  };
  switch (ev.type) {
    case "client_checked_in":
      s.clients[ev.clientId] = {
        id: ev.clientId,
        firstName: ev.firstName.trim(),
        lastName: ev.lastName.trim(),
        practiceAreaId: ev.practiceAreaId,
        language: ev.language,
        description: ev.description.trim(),
        status: "arrived",
        arrivedAt: ev.at,
      };
      s.clientOrder = [...state.clientOrder, ev.clientId];
      break;
    case "form_turned_in":
      s.clients[ev.clientId] = { ...s.clients[ev.clientId], status: "waiting", waitingAt: ev.at };
      break;
    case "session_started": {
      const c = s.clients[ev.clientId];
      s.clients[ev.clientId] = {
        ...c,
        status: "with_attorney",
        // An attorney may grab a paper before staff marked it turned in; absorb that.
        waitingAt: c.waitingAt ?? ev.at,
        sessionStartedAt: ev.at,
        attorneyId: ev.attorneyId,
      };
      s.sessions[ev.sessionId] = { id: ev.sessionId, clientId: ev.clientId, attorneyId: ev.attorneyId, startedAt: ev.at };
      s.attorneys[ev.attorneyId] = {
        ...s.attorneys[ev.attorneyId],
        status: "in_session",
        currentClientId: ev.clientId,
        currentSessionId: ev.sessionId,
      };
      break;
    }
    case "session_ended": {
      const session = s.sessions[ev.sessionId];
      s.clients[session.clientId] = { ...s.clients[session.clientId], status: "done", finishedAt: ev.at };
      endSession(s, ev.sessionId, ev.at, "done", ev.attorneyContinues);
      break;
    }
    case "client_left": {
      const c = s.clients[ev.clientId];
      if (c.status === "with_attorney") {
        const open = Object.values(s.sessions).find((x) => x.clientId === c.id && !x.endedAt);
        if (open) endSession(s, open.id, ev.at, "client_left", true);
      }
      s.clients[ev.clientId] = { ...c, status: "left", leftAt: ev.at, leftFrom: c.status };
      break;
    }
    case "client_updated": {
      const c = s.clients[ev.clientId];
      s.clients[ev.clientId] = {
        ...c,
        practiceAreaId: ev.practiceAreaId ?? c.practiceAreaId,
        description: ev.description?.trim() ?? c.description,
        language: ev.language ?? c.language,
      };
      break;
    }
    case "attorney_checked_in": {
      const prev = s.attorneys[ev.attorneyId];
      s.attorneys[ev.attorneyId] = {
        id: ev.attorneyId,
        name: ev.name.trim(),
        practiceAreaIds: ev.practiceAreaIds,
        spanish: ev.spanish,
        walkIn: !!ev.walkIn,
        checkedInAt: prev?.checkedInAt ?? ev.at,
        leaveBy: ev.leaveBy,
        status: "available",
        clientsSeen: prev?.clientsSeen ?? 0,
      };
      break;
    }
    case "attorney_checked_out":
      s.attorneys[ev.attorneyId] = { ...s.attorneys[ev.attorneyId], status: "checked_out", checkedOutAt: ev.at };
      break;
    case "area_override":
      s.closedAreas = { ...state.closedAreas, [ev.practiceAreaId]: ev.closed };
      break;
  }
  return s;
}

export function replay(events: ClinicEvent[]): ClinicState {
  return events.reduce(apply, emptyState());
}

/* ------------------------------------------------------------------ */
/* Display helpers                                                     */
/* ------------------------------------------------------------------ */

/** "Joe S." — names are never shown in full on shared screens. */
export function displayName(c: Pick<Client, "firstName" | "lastName">): string {
  const initial = c.lastName.trim().charAt(0);
  return initial ? `${c.firstName} ${initial.toUpperCase()}.` : c.firstName;
}

export function statusLabel(s: Client["status"]): string {
  return { arrived: "On deck", waiting: "Waiting", with_attorney: "With attorney", done: "Done", left: "Left" }[s];
}

export function minsSince(t: number | undefined, now: number): number {
  return t ? Math.max(0, Math.floor((now - t) / MIN)) : 0;
}

export function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function fmtClock(t: number): string {
  return new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function describeEvent(e: ClinicEvent, state: ClinicState): string {
  const c = "clientId" in e ? state.clients[e.clientId] : undefined;
  const name = c ? displayName(c) : "client";
  switch (e.type) {
    case "client_checked_in":
      return `Checked in ${displayName(e)} (${AREA_BY_ID[e.practiceAreaId]?.short})`;
    case "form_turned_in":
      return `${name} turned in their form`;
    case "session_started":
      return `${state.attorneys[e.attorneyId]?.name ?? "Attorney"} is seeing ${name}`;
    case "session_ended": {
      const s = state.sessions[e.sessionId];
      const cl = s ? state.clients[s.clientId] : undefined;
      return `${cl ? displayName(cl) : "Client"} is done${e.attorneyContinues ? "" : "; attorney checked out"}`;
    }
    case "client_left":
      return `${name} left`;
    case "client_updated":
      return `Updated ${name}`;
    case "attorney_checked_in":
      return `${e.name} checked in`;
    case "attorney_checked_out":
      return `${state.attorneys[e.attorneyId]?.name ?? "Attorney"} checked out`;
    case "area_override":
      return `${AREA_BY_ID[e.practiceAreaId]?.short} ${e.closed ? "closed for tonight" : "reopened"}`;
  }
}

/* ------------------------------------------------------------------ */
/* Live picture                                                        */
/* ------------------------------------------------------------------ */

export function activeClients(state: ClinicState): Client[] {
  return state.clientOrder.map((id) => state.clients[id]).filter((c) => c.status !== "done" && c.status !== "left");
}

export function presentAttorneys(state: ClinicState): AttorneyOnSite[] {
  return Object.values(state.attorneys)
    .filter((a) => a.status !== "checked_out")
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Waiting clients in an area, first come first served by form turn-in time. */
export function queueFor(state: ClinicState, areaId: string): Client[] {
  return Object.values(state.clients)
    .filter((c) => c.status === "waiting" && c.practiceAreaId === areaId)
    .sort((a, b) => (a.waitingAt ?? 0) - (b.waitingAt ?? 0));
}

/** Average session length tonight, falling back to the default until we have 3 data points. */
export function avgSessionMins(state: ClinicState): { mins: number; fromTonight: boolean } {
  const done = Object.values(state.sessions).filter((s) => s.endedAt && s.outcome === "done");
  if (done.length < 3) return { mins: THRESHOLDS.defaultSessionMins, fromTonight: false };
  const total = done.reduce((sum, s) => sum + (s.endedAt! - s.startedAt), 0);
  return { mins: Math.max(5, Math.round(total / done.length / MIN)), fromTonight: true };
}

/**
 * Estimate when each waiting client (and a hypothetical new arrival) would be
 * seen. Simulates the tray: every present attorney who covers the area becomes
 * free at "now" or when their current session should end, then takes the next
 * paper. Nobody starts a session less than half a session before close or
 * before the attorney's stated leave time.
 *
 * Example from the kickoff: one attorney 15 min into a 30 min session, two
 * people already in line → the third person waits ~1h15.
 */
function simulate(
  attorneys: AttorneyWithStart[],
  line: Client[],
  now: number,
  avgMs: number,
  closesAt: number,
): { starts: (number | null)[]; nextStart: number | null } {
  // Busy attorneys free up when their session should end (or ~5 min from now if it's running long).
  const freeAt = attorneys.map((a) =>
    a.status === "available" ? now : Math.max(now + 5 * MIN, (a.currentSessionStartedAt ?? now) + avgMs),
  );
  const take = (): number | null => {
    let best = -1;
    for (let i = 0; i < attorneys.length; i++) {
      // No new session that would run more than half its length past close / the attorney's leave time.
      const lastStart = Math.min(attorneys[i].leaveBy ?? Infinity, closesAt) - avgMs / 2;
      if (freeAt[i] > lastStart) continue;
      if (best === -1 || freeAt[i] < freeAt[best]) best = i;
    }
    if (best === -1) return null;
    const start = freeAt[best];
    freeAt[best] = start + avgMs;
    return start;
  };
  const starts = line.map(() => take());
  return { starts, nextStart: take() };
}

type AttorneyWithStart = AttorneyOnSite & { currentSessionStartedAt?: number };

export function areaSnapshot(state: ClinicState, area: PracticeArea, now: number, clinic: Clinic): AreaSnapshot {
  const here: AttorneyWithStart[] = presentAttorneys(state)
    .filter((a) => a.practiceAreaIds.includes(area.id))
    .map((a) => ({
      ...a,
      currentSessionStartedAt: a.currentSessionId ? state.sessions[a.currentSessionId]?.startedAt : undefined,
    }));
  const waiting = queueFor(state, area.id);
  const onDeck = activeClients(state).filter((c) => c.status === "arrived" && c.practiceAreaId === area.id);
  const withAttorney = activeClients(state).filter((c) => c.status === "with_attorney" && c.practiceAreaId === area.id);
  const avgMs = avgSessionMins(state).mins * MIN;

  // On-deck clients haven't turned in a form yet but will join the line, so count them for capacity.
  const line = [...waiting, ...onDeck];
  const sim = simulate(here, line, now, avgMs, clinic.closesAt);
  const estStartById: Record<string, number | null> = {};
  line.forEach((c, i) => (estStartById[c.id] = sim.starts[i]));
  const estWaitNewMins = sim.nextStart === null ? null : Math.round((sim.nextStart - now) / MIN);

  const closedByStaff = !!state.closedAreas[area.id];
  let light: Light;
  let reason: string;
  const demand = line.length;
  if (closedByStaff) {
    light = "red";
    reason = "Closed for tonight by staff";
  } else if (here.length === 0) {
    light = demand > 0 ? "red" : "none";
    reason = demand > 0 ? `No attorney here, ${demand} client${demand === 1 ? "" : "s"} in line` : "No attorney checked in yet";
  } else if (estWaitNewMins === null) {
    light = "red";
    reason = "A new client likely won't be seen before close";
  } else if (estWaitNewMins <= THRESHOLDS.greenMaxWaitMins) {
    light = "green";
    reason = estWaitNewMins <= 5 ? "Come on in, no wait" : `Come on in, about ${fmtDuration(estWaitNewMins)}`;
  } else if (estWaitNewMins <= THRESHOLDS.yellowMaxWaitMins) {
    light = "yellow";
    reason = `Come in, but expect about ${fmtDuration(estWaitNewMins)}`;
  } else {
    light = "red";
    reason = `Wait would be about ${fmtDuration(estWaitNewMins)}`;
  }

  return {
    area,
    light,
    reason,
    attorneysHere: here.length,
    attorneysFree: here.filter((a) => a.status === "available").length,
    attorneysBusy: here.filter((a) => a.status === "in_session").length,
    waiting,
    onDeck,
    withAttorney,
    estWaitNewMins,
    estStartById,
    closedByStaff,
  };
}

export function allAreaSnapshots(state: ClinicState, now: number, clinic: Clinic): AreaSnapshot[] {
  return PRACTICE_AREAS.map((a) => areaSnapshot(state, a, now, clinic));
}

/* ------------------------------------------------------------------ */
/* QA / QC                                                             */
/* ------------------------------------------------------------------ */

const severityRank = { critical: 0, warning: 1, info: 2 } as const;

export function qaAlerts(state: ClinicState, now: number, clinic: Clinic): QaAlert[] {
  const T = THRESHOLDS;
  const out: QaAlert[] = [];
  const active = activeClients(state);
  const present = presentAttorneys(state);

  for (const c of active) {
    const area = AREA_BY_ID[c.practiceAreaId]?.short ?? "";
    const who = `${displayName(c)} (${c.description}, ${area})`;
    if (c.status === "waiting") {
      const m = minsSince(c.waitingAt, now);
      if (m >= T.waitingCriticalMins)
        out.push({ id: `wait-${c.id}`, severity: "critical", message: `${who} has waited ${fmtDuration(m)}. Check on them now.`, clientId: c.id });
      else if (m >= T.waitingWarnMins)
        out.push({ id: `wait-${c.id}`, severity: "warning", message: `${who} has waited ${fmtDuration(m)}.`, clientId: c.id });
    } else if (c.status === "arrived") {
      const m = minsSince(c.arrivedAt, now);
      if (m >= T.formNotInMins)
        out.push({ id: `form-${c.id}`, severity: "warning", message: `${who} checked in ${fmtDuration(m)} ago but no form is recorded. Still here?`, clientId: c.id });
    } else if (c.status === "with_attorney") {
      const m = minsSince(c.sessionStartedAt, now);
      if (m >= T.sessionLongMins)
        out.push({ id: `sess-${c.id}`, severity: "info", message: `${who} has been with ${state.attorneys[c.attorneyId!]?.name ?? "an attorney"} for ${fmtDuration(m)}. Was the paper handed back?`, clientId: c.id });
    }
  }

  for (const a of present) {
    if (a.leaveBy && now > a.leaveBy && a.status === "available")
      out.push({ id: `leave-${a.id}`, severity: "warning", message: `${a.name} planned to leave at ${fmtClock(a.leaveBy)}. Check them out if they've gone.`, attorneyId: a.id });
  }

  for (const area of PRACTICE_AREAS) {
    const line = active.filter((c) => c.practiceAreaId === area.id && (c.status === "waiting" || c.status === "arrived"));
    if (line.length === 0) continue;
    const covering = present.filter((a) => a.practiceAreaIds.includes(area.id));
    if (covering.length === 0) {
      out.push({ id: `nocover-${area.id}`, severity: "critical", message: `${line.length} ${area.short} client${line.length === 1 ? " is" : "s are"} in line and no ${area.short} attorney is here.` });
    } else if (line.some((c) => c.language === "Spanish") && !covering.some((a) => a.spanish)) {
      out.push({ id: `es-${area.id}`, severity: "info", message: `A Spanish-speaking ${area.short} client is in line and no Spanish-speaking ${area.short} attorney is here. Line up a translator.` });
    }
  }

  const minsToClose = Math.round((clinic.closesAt - now) / MIN);
  if (minsToClose <= 30 && active.length > 0)
    out.push({
      id: "closing",
      severity: minsToClose <= 0 ? "critical" : "warning",
      message: minsToClose <= 0
        ? `Clinic is past closing time with ${active.length} client${active.length === 1 ? "" : "s"} unaccounted for.`
        : `Closing in ${minsToClose} min with ${active.length} client${active.length === 1 ? "" : "s"} still in the building.`,
    });

  return out.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

/** The head-count check: who should physically be where right now. */
export function headCounts(state: ClinicState) {
  const active = activeClients(state);
  const all = Object.values(state.clients);
  const present = presentAttorneys(state);
  return {
    onDeck: active.filter((c) => c.status === "arrived").length,
    waiting: active.filter((c) => c.status === "waiting").length,
    withAttorney: active.filter((c) => c.status === "with_attorney").length,
    inWaitingRoom: active.filter((c) => c.status === "arrived" || c.status === "waiting").length,
    inBuilding: active.length,
    done: all.filter((c) => c.status === "done").length,
    left: all.filter((c) => c.status === "left").length,
    total: all.length,
    attorneysPresent: present.length,
    attorneysFree: present.filter((a) => a.status === "available").length,
    attorneysBusy: present.filter((a) => a.status === "in_session").length,
  };
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export function summarizeNight(clinic: Clinic, state: ClinicState, closedAt: number): NightSummary {
  const clients = Object.values(state.clients);
  const sessions = Object.values(state.sessions);
  const waits = clients
    .filter((c) => c.waitingAt && c.sessionStartedAt)
    .map((c) => (c.sessionStartedAt! - c.waitingAt!) / MIN);
  const lens = sessions.filter((s) => s.endedAt && s.outcome === "done").map((s) => (s.endedAt! - s.startedAt) / MIN);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const byArea: NightSummary["byArea"] = {};
  for (const c of clients) {
    const row = (byArea[c.practiceAreaId] ??= { served: 0, left: 0, checkedIn: 0 });
    row.checkedIn++;
    if (c.status === "done") row.served++;
    if (c.status === "left") row.left++;
  }
  const atts = Object.values(state.attorneys);
  return {
    clinicId: clinic.id,
    date: clinic.date,
    openedAt: clinic.openedAt,
    closedAt,
    clientsCheckedIn: clients.length,
    clientsServed: clients.filter((c) => c.status === "done").length,
    clientsLeft: clients.filter((c) => c.status === "left").length,
    attorneyIds: atts.map((a) => a.id),
    attorneyNames: atts.map((a) => a.name),
    avgWaitMins: avg(waits),
    avgSessionMins: avg(lens),
    byArea,
  };
}
