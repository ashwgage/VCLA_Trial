import type { Metadata } from "next";
import { ClinicGate } from "@/components/ClinicGate";
import { FrontDeskView } from "@/components/views/FrontDeskView";

export const metadata: Metadata = { title: "Front Desk" };

export default function Page() {
  return (
    <ClinicGate>
      <FrontDeskView />
    </ClinicGate>
  );
}
