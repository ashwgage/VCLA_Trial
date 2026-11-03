import type { Metadata } from "next";
import { ClinicGate } from "@/components/ClinicGate";
import { CloseOutView } from "@/components/views/CloseOutView";

export const metadata: Metadata = { title: "Close Out" };

export default function Page() {
  return (
    <ClinicGate>
      <CloseOutView />
    </ClinicGate>
  );
}
