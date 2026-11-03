"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AREA_BY_ID } from "@/lib/config";
import { displayName, fmtDuration, minsSince } from "@/lib/engine";
import type { AttorneyOnSite, Client, RosterAttorney } from "@/lib/types";
import { StatusPill, cx } from "./ui";

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="search"
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="mb-3 w-full rounded-xl border-0 px-4 py-3 text-lg ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-600"
    />
  );
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Find a client by first name, last name OR what they're wearing. */
export function ClientPicker({
  clients,
  now,
  onPick,
  emptyText = "No matching clients.",
  badge,
  showSearch = true,
}: {
  clients: Client[];
  now: number;
  onPick: (c: Client) => void;
  emptyText?: string;
  badge?: (c: Client) => ReactNode;
  showSearch?: boolean;
}) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return clients;
    return clients.filter((c) => norm(`${c.firstName} ${c.lastName} ${c.description}`).includes(n));
  }, [clients, q]);
  return (
    <div>
      {showSearch && clients.length > 4 && <SearchBox value={q} onChange={setQ} placeholder="Type a first name or what they're wearing…" />}
      {shown.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-slate-600">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((c) => {
            const since =
              c.status === "arrived"
                ? `checked in ${fmtDuration(minsSince(c.arrivedAt, now))} ago`
                : c.status === "waiting"
                  ? `waiting ${fmtDuration(minsSince(c.waitingAt, now))}`
                  : c.status === "with_attorney"
                    ? `with attorney ${fmtDuration(minsSince(c.sessionStartedAt, now))}`
                    : "";
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onPick(c)}
                  className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left ring-1 ring-slate-300 hover:bg-blue-50 hover:ring-blue-400 focus-visible:outline-3 focus-visible:outline-blue-600"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-900">
                      {c.firstName} {c.lastName}
                      <span className="font-normal text-slate-500"> · {c.description}</span>
                    </span>
                    <span className="block text-sm text-slate-600">
                      {AREA_BY_ID[c.practiceAreaId]?.name}
                      {c.language !== "English" && ` · ${c.language}`}
                      {since && ` · ${since}`}
                    </span>
                  </span>
                  {badge?.(c)}
                  <StatusPill status={c.status} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function AreaChips({ ids }: { ids: string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {ids.map((id) => (
        <span key={id} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">
          {AREA_BY_ID[id]?.short ?? id}
        </span>
      ))}
    </span>
  );
}

export function SpanishBadge() {
  return <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-900">Español</span>;
}

/** Pick an attorney who is checked in tonight. */
export function AttorneyPicker({
  attorneys,
  onPick,
  isDisabled,
  emptyText = "No attorneys match.",
  now,
}: {
  attorneys: AttorneyOnSite[];
  onPick: (a: AttorneyOnSite) => void;
  isDisabled?: (a: AttorneyOnSite) => string | null;
  emptyText?: string;
  now: number;
}) {
  const [q, setQ] = useState("");
  const shown = attorneys.filter((a) => norm(a.name).includes(norm(q.trim())));
  return (
    <div>
      {attorneys.length > 5 && <SearchBox value={q} onChange={setQ} placeholder="Type the attorney's name…" />}
      {shown.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-slate-600">{emptyText}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {shown.map((a) => {
            const why = isDisabled?.(a) ?? null;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  disabled={!!why}
                  onClick={() => onPick(a)}
                  className={cx(
                    "flex h-full w-full flex-col items-start gap-1 rounded-xl bg-white p-3 text-left ring-1 ring-slate-300",
                    "hover:bg-blue-50 hover:ring-blue-400 focus-visible:outline-3 focus-visible:outline-blue-600",
                    "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70 disabled:hover:ring-slate-300",
                  )}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{a.name}</span>
                    <span
                      className={cx(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        a.status === "available" ? "bg-green-100 text-green-900" : "bg-violet-100 text-violet-900",
                      )}
                    >
                      {a.status === "available" ? "Free" : "With client"}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1">
                    <AreaChips ids={a.practiceAreaIds} />
                    {a.spanish && <SpanishBadge />}
                  </span>
                  <span className="text-xs text-slate-500">
                    Here {fmtDuration(minsSince(a.checkedInAt, now))} · seen {a.clientsSeen}
                  </span>
                  {why && <span className="text-sm text-slate-600">{why}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Pick from the full volunteer list (for checking attorneys in). */
export function RosterPicker({
  roster,
  presentIds,
  onPick,
}: {
  roster: RosterAttorney[];
  presentIds: Set<string>;
  onPick: (r: RosterAttorney) => void;
}) {
  const [q, setQ] = useState("");
  const shown = roster.filter((r) => norm(r.name).includes(norm(q.trim())));
  return (
    <div>
      <SearchBox value={q} onChange={setQ} placeholder="Start typing their name…" />
      <ul className="grid max-h-[28rem] gap-2 overflow-y-auto sm:grid-cols-2">
        {shown.map((r) => {
          const here = presentIds.has(r.id);
          return (
            <li key={r.id}>
              <button
                type="button"
                disabled={here}
                onClick={() => onPick(r)}
                className="flex h-full w-full flex-col items-start gap-1 rounded-xl bg-white p-3 text-left ring-1 ring-slate-300 hover:bg-blue-50 hover:ring-blue-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60"
              >
                <span className="font-semibold text-slate-900">
                  {r.name} {here && <span className="text-sm font-normal text-slate-500">(already here)</span>}
                </span>
                <span className="flex flex-wrap items-center gap-1">
                  <AreaChips ids={r.practiceAreaIds} />
                  {r.spanish && <SpanishBadge />}
                </span>
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="text-slate-600">Nobody on the list matches “{q}”.</li>}
      </ul>
    </div>
  );
}

export { displayName };
