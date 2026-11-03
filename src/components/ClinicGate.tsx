"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useClinic, type ClinicSnapshot } from "@/lib/store";
import type { Clinic } from "@/lib/types";
import { Card } from "./ui";

/** Shows a loading state until local data is read, and a "start the clinic" prompt if none is open. */
export function ClinicGate({ children }: { children: ReactNode }) {
  const { ready, clinic } = useClinic();
  if (!ready) return <div className="py-20 text-center text-slate-500">Loading…</div>;
  if (!clinic)
    return (
      <Card className="mx-auto mt-10 max-w-lg text-center">
        <h1 className="text-xl font-bold">No clinic is open right now</h1>
        <p className="mt-2 text-slate-600">Start tonight&apos;s clinic (or load the sample night) from the home screen.</p>
        <Link href="/" className="mt-4 inline-block rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800">
          Go to home
        </Link>
      </Card>
    );
  return <>{children}</>;
}

/** For components rendered inside <ClinicGate>: the clinic is guaranteed to be open. */
export function useOpenClinic(): ClinicSnapshot & { clinic: Clinic } {
  const snap = useClinic();
  if (!snap.clinic) throw new Error("useOpenClinic used outside <ClinicGate>");
  return snap as ClinicSnapshot & { clinic: Clinic };
}
