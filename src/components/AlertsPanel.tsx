import type { QaAlert } from "@/lib/types";
import { cx } from "./ui";

const tone = {
  critical: "bg-red-50 text-red-900 ring-red-300",
  warning: "bg-amber-50 text-amber-950 ring-amber-300",
  info: "bg-sky-50 text-sky-950 ring-sky-200",
};
const icon = { critical: "⛔", warning: "⚠️", info: "ℹ️" };

export function AlertsPanel({ alerts, emptyText = "Everyone is accounted for." }: { alerts: QaAlert[]; emptyText?: string }) {
  if (alerts.length === 0)
    return <p className="rounded-xl bg-green-50 px-4 py-3 font-medium text-green-900 ring-1 ring-green-200">✓ {emptyText}</p>;
  return (
    <ul className="space-y-2">
      {alerts.map((a) => (
        <li key={a.id} className={cx("flex gap-2 rounded-xl px-3 py-2 ring-1", tone[a.severity])}>
          <span aria-hidden>{icon[a.severity]}</span>
          <span>
            <span className="sr-only">{a.severity}: </span>
            {a.message}
          </span>
        </li>
      ))}
    </ul>
  );
}
