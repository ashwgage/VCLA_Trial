import { describe, expect, it } from "vitest";
import { AREA_BY_ID } from "../config";
import { apply, areaSnapshot, emptyState, qaAlerts, queueFor, replay, validate } from "../engine";
import type { Clinic, ClinicEvent, EventBody } from "../types";

const MIN = 60_000;
const NOW = Date.UTC(2026, 10, 3, 2, 0); // fixed clock
const clinic: Clinic = { id: "c", date: "2026-11-03", openedAt: NOW - 120 * MIN, closesAt: NOW + 180 * MIN };

let seq = 0;
const ev = (minsAgo: number, body: EventBody): ClinicEvent => ({ ...body, id: `e${seq++}`, at: NOW - minsAgo * MIN, station: "system" }) as ClinicEvent;
const client = (minsAgo: number, id: string, area = "housing"): ClinicEvent =>
  ev(minsAgo, { type: "client_checked_in", clientId: id, firstName: id, lastName: "X", practiceAreaId: area, language: "English", description: "hat" });
const attorney = (minsAgo: number, id: string, areas = ["housing"]): ClinicEvent =>
  ev(minsAgo, { type: "attorney_checked_in", attorneyId: id, name: id, practiceAreaIds: areas, spanish: false });

describe("queue", () => {
  it("is first come first served by form turn-in time, not check-in time", () => {
    const s = replay([
      client(60, "early"),
      client(50, "late"),
      ev(40, { type: "form_turned_in", clientId: "late" }),
      ev(30, { type: "form_turned_in", clientId: "early" }),
    ]);
    expect(queueFor(s, "housing").map((c) => c.id)).toEqual(["late", "early"]);
  });
});

describe("wait estimate", () => {
  it("matches the kickoff example: 3rd in line, one attorney, ~30 min each → about 1h15", () => {
    const s = replay([
      attorney(90, "joe"),
      client(80, "a"),
      client(79, "b"),
      client(78, "c"),
      ev(70, { type: "form_turned_in", clientId: "a" }),
      ev(69, { type: "form_turned_in", clientId: "b" }),
      ev(68, { type: "form_turned_in", clientId: "c" }),
      ev(15, { type: "session_started", sessionId: "s1", clientId: "a", attorneyId: "joe" }),
    ]);
    const snap = areaSnapshot(s, AREA_BY_ID.housing, NOW, clinic);
    // b starts in 15, c in 45, a new arrival in 75.
    expect(snap.estWaitNewMins).toBe(75);
    expect(snap.light).toBe("yellow");
  });

  it("is green with a free attorney and red with no capacity before close", () => {
    const free = replay([attorney(10, "joe")]);
    expect(areaSnapshot(free, AREA_BY_ID.housing, NOW, clinic).light).toBe("green");

    const lateClinic = { ...clinic, closesAt: NOW + 20 * MIN };
    const busy = replay([attorney(30, "joe"), client(25, "a"), ev(20, { type: "session_started", sessionId: "s", clientId: "a", attorneyId: "joe" })]);
    expect(areaSnapshot(busy, AREA_BY_ID.housing, NOW, lateClinic).light).toBe("red");
  });

  it("goes red when staff close an area for the night", () => {
    const s = replay([attorney(10, "joe"), ev(1, { type: "area_override", practiceAreaId: "housing", closed: true })]);
    expect(areaSnapshot(s, AREA_BY_ID.housing, NOW, clinic).light).toBe("red");
  });
});

describe("validation absorbs mistakes", () => {
  it("won't double-book an attorney or check out someone mid-session", () => {
    const s = replay([attorney(30, "joe"), client(25, "a"), client(24, "b"), ev(20, { type: "session_started", sessionId: "s", clientId: "a", attorneyId: "joe" })]);
    expect(validate(s, { type: "session_started", sessionId: "s2", clientId: "b", attorneyId: "joe" })).toMatch(/already with a client/);
    expect(validate(s, { type: "attorney_checked_out", attorneyId: "joe" })).toMatch(/still with a client/);
  });

  it("ignores undone events on replay", () => {
    const events = [client(10, "a"), { ...ev(5, { type: "form_turned_in", clientId: "a" }), undone: true }];
    expect(replay(events).clients.a.status).toBe("arrived");
  });

  it("frees the attorney when a client leaves mid-session", () => {
    let s = replay([attorney(30, "joe"), client(25, "a"), ev(20, { type: "session_started", sessionId: "s", clientId: "a", attorneyId: "joe" })]);
    s = apply(s, ev(5, { type: "client_left", clientId: "a" }));
    expect(s.clients.a.status).toBe("left");
    expect(s.attorneys.joe.status).toBe("available");
    expect(s.sessions.s.outcome).toBe("client_left");
  });
});

describe("QA/QC", () => {
  it("flags long waits and lines with no attorney", () => {
    const s = replay([client(120, "a"), ev(95, { type: "form_turned_in", clientId: "a" })]);
    const ids = qaAlerts(s, NOW, clinic).map((a) => a.id);
    expect(ids).toContain("wait-a");
    expect(ids).toContain("nocover-housing");
  });

  it("starts from a clean state", () => {
    expect(queueFor(emptyState(), "housing")).toEqual([]);
  });
});
