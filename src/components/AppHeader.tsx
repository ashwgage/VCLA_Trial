"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClinic } from "@/lib/store";
import { useNow } from "@/lib/useNow";
import { fmtClock } from "@/lib/engine";
import { cx } from "./ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/entrance", label: "Entrance" },
  { href: "/nerve-center", label: "Nerve Center" },
  { href: "/front-desk", label: "Front Desk" },
  { href: "/close-out", label: "Close Out" },
  { href: "/reports", label: "Reports" },
];

export function AppHeader() {
  const pathname = usePathname();
  const { ready, clinic } = useClinic();
  const now = useNow();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
        <Link href="/" className="flex items-center gap-2 font-bold text-slate-900">
          <span className="grid size-8 place-items-center rounded-lg bg-blue-700 text-sm font-black text-white" aria-hidden>
            V
          </span>
          <span className="hidden sm:inline">VCLA Clinic Night</span>
        </Link>
        <div className="ml-auto flex items-center gap-2 text-sm">
          {ready && (
            <span
              className={cx(
                "rounded-full px-2.5 py-1 font-medium",
                clinic ? "bg-green-100 text-green-900" : "bg-slate-100 text-slate-600",
              )}
            >
              {clinic ? `Open · closes ${fmtClock(clinic.closesAt)}` : "No clinic open"}
            </span>
          )}
          {ready && <span className="font-semibold tabular-nums text-slate-700">{fmtClock(now)}</span>}
        </div>
      </div>
      <nav aria-label="Stations" className="mx-auto max-w-7xl overflow-x-auto px-2">
        <ul className="flex min-w-max gap-1 pb-2">
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "block rounded-lg px-3 py-1.5 text-sm font-semibold",
                    active ? "bg-blue-700 text-white" : "text-slate-700 hover:bg-slate-100",
                  )}
                >
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
