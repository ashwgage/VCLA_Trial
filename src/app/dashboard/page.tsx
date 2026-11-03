import type { Metadata } from "next";
import { ClinicGate } from "@/components/ClinicGate";
import { DashboardView } from "@/components/views/DashboardView";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return (
    <ClinicGate>
      <DashboardView />
    </ClinicGate>
  );
}
