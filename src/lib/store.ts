"use client";

/**
 * Demo data store.
 *
 * Persists the event log to localStorage and syncs every open tab in the same
 * browser instantly (BroadcastChannel + storage events), so you can open the
 * Entrance, Nerve Center and Dashboard side by side and watch them update.
 *
 * PRODUCTION SWAP: replace this file with one backed by a hosted database
 * (see README "Architecture"). Components only use `useClinic()` and the
 * action functions below, so nothing else needs to change.
 */
import { useSyncExternalStore } from "react";
import { THRESHOLDS } from "./config";
import { describeEvent, replay, summarizeNight, validate } from "./engine";
import { newId } from "./ids";
import { buildSampleNight } from "./sample";
import type { Clinic, ClinicEvent, ClinicState, EventBody, NightSummary, Station } from "./types";

const KEY = "vcla.clinic.v1";
const HISTORY_KEY = "vcla.history.v1";

interface Persisted {
  clinic: Clinic | null;
  events: ClinicEvent[];
}

export interface ClinicSnapshot {
  ready: boolean;
  clinic: Clinic | null;
  events: ClinicEvent[];
  state: ClinicState;
  history: NightSummary[];
}

const SERVER_SNAPSHOT: ClinicSnapshot = {
  ready: false,
  clinic: null,
  events: [],
  state: replay([]),
  history: [],
};

let snapshot: ClinicSnapshot | null = null;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function load(): ClinicSnapshot {
  const p = readJson<Persisted>(KEY, { clinic: null, events: [] });
  return {
    ready: true,
    clinic: p.clinic,
    events: p.events,
    state: replay(p.events),
    history: readJson<NightSummary[]>(HISTORY_KEY, []),
  };
}

function getSnapshot(): ClinicSnapshot {
  if (!snapshot) snapshot = load();
  return snapshot;
}

function emit() {
  listeners.forEach((l) => l());
}

function save(next: Persisted, history?: NightSummary[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    if (history) window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Storage full or blocked: keep working in memory for this tab.
  }
  snapshot = {
    ready: true,
    clinic: next.clinic,
    events: next.events,
    state: replay(next.events),
    history: history ?? getSnapshot().history,
  };
  channel?.postMessage("changed");
  emit();
}

let teardown: (() => void) | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    // Another tab (or, in production, another device) changed the data: reload and re-render.
    const refresh = () => {
      snapshot = load();
      emit();
    };
    window.addEventListener("storage", refresh);
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel("vcla-clinic");
      channel.onmessage = refresh;
    }
    teardown = () => {
      window.removeEventListener("storage", refresh);
      channel?.close();
      channel = null;
    };
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      teardown?.();
      teardown = null;
    }
  };
}

export function useClinic(): ClinicSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export type DispatchResult = { ok: true; event: ClinicEvent; message: string } | { ok: false; error: string };

export function dispatch(body: EventBody, station: Station): DispatchResult {
  const snap = getSnapshot();
  if (!snap.clinic) return { ok: false, error: "No clinic is open. Start tonight's clinic first." };
  const error = validate(snap.state, body);
  if (error) return { ok: false, error };
  const event = { ...body, id: newId("e"), at: Date.now(), station } as ClinicEvent;
  const events = [...snap.events, event];
  save({ clinic: snap.clinic, events });
  return { ok: true, event, message: describeEvent(event, getSnapshot().state) };
}

/** The most recent action that can still be undone. */
export function lastUndoable(): ClinicEvent | undefined {
  const { events } = getSnapshot();
  for (let i = events.length - 1; i >= 0; i--) if (!events[i].undone) return events[i];
  return undefined;
}

/**
 * Undo is stack-based (most recent action first) so replay always stays
 * consistent. Undone events stay in the log, flagged, for the audit trail.
 */
export function undoLast(expectedEventId?: string): DispatchResult {
  const snap = getSnapshot();
  const target = lastUndoable();
  if (!snap.clinic || !target) return { ok: false, error: "Nothing to undo." };
  if (expectedEventId && target.id !== expectedEventId)
    return { ok: false, error: "Someone has made another change since then. Use Fix a mistake on the Nerve Center instead." };
  const message = `Undid: ${describeEvent(target, snap.state)}`;
  const events = snap.events.map((e) => (e.id === target.id ? { ...e, undone: true } : e));
  save({ clinic: snap.clinic, events });
  return { ok: true, event: target, message };
}

export function startClinic(closeHour = THRESHOLDS.defaultCloseHour, closeMinute = THRESHOLDS.defaultCloseMinute) {
  const now = new Date();
  const closes = new Date(now);
  closes.setHours(closeHour, closeMinute, 0, 0);
  if (closes.getTime() <= now.getTime()) closes.setTime(now.getTime() + 3 * 3600_000);
  const clinic: Clinic = {
    id: newId("c"),
    date: localDate(now),
    openedAt: now.getTime(),
    closesAt: closes.getTime(),
  };
  save({ clinic, events: [] });
}

export function closeClinic() {
  const snap = getSnapshot();
  if (!snap.clinic) return;
  const summary = summarizeNight(snap.clinic, snap.state, Date.now());
  const history = [...snap.history.filter((h) => h.clinicId !== summary.clinicId), summary];
  save({ clinic: null, events: [] }, history);
}

export function loadSampleNight() {
  const { clinic, events, history } = buildSampleNight(Date.now());
  const existing = getSnapshot().history.filter((h) => !h.clinicId.startsWith("sample-"));
  save({ clinic, events }, [...history, ...existing]);
}

export function resetEverything() {
  save({ clinic: null, events: [] }, []);
}

export function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
