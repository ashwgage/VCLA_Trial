import type { Metadata } from "next";
import { ClinicGate } from "@/components/ClinicGate";
import { EntranceView } from "@/components/views/EntranceView";

export const metadata: Metadata = { title: "Entrance" };

export default function Page() {
  return (
    <ClinicGate>
      <EntranceView />
    </ClinicGate>
  );
}
