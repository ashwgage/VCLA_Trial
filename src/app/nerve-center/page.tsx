import type { Metadata } from "next";
import { ClinicGate } from "@/components/ClinicGate";
import { NerveCenterView } from "@/components/views/NerveCenterView";

export const metadata: Metadata = { title: "Nerve Center" };

export default function Page() {
  return (
    <ClinicGate>
      <NerveCenterView />
    </ClinicGate>
  );
}
