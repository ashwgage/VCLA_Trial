import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Light } from "@/lib/types";

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-blue-700 text-white hover:bg-blue-800 disabled:bg-blue-300",
  secondary: "bg-white text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50 disabled:text-slate-400",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
  ghost: "text-slate-700 hover:bg-slate-100",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "md" | "lg" }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed",
        size === "lg" ? "min-h-14 px-6 text-lg" : "min-h-11 px-4 text-base",
        variants[variant],
        className,
      )}
    />
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5", className)}>{children}</section>;
}

export function PageTitle({ title, subtitle, right }: { title: string; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-600">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

/** A large, single-purpose choice button used by the guided "What are you doing?" screens. */
export function BigChoice({
  title,
  hint,
  onClick,
  icon,
  tone = "default",
  disabled,
}: {
  title: string;
  hint?: string;
  onClick: () => void;
  icon?: ReactNode;
  tone?: "default" | "danger" | "muted";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "flex w-full items-center gap-4 rounded-2xl p-4 text-left ring-1 transition sm:p-5",
        "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50",
        tone === "danger" && "bg-red-50 ring-red-200 hover:bg-red-100",
        tone === "muted" && "bg-slate-50 ring-slate-200 hover:bg-slate-100",
        tone === "default" && "bg-white ring-slate-300 hover:bg-blue-50 hover:ring-blue-400",
      )}
    >
      {icon && <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-slate-100 text-2xl" aria-hidden>{icon}</span>}
      <span className="min-w-0">
        <span className="block text-lg font-semibold text-slate-900">{title}</span>
        {hint && <span className="mt-0.5 block text-slate-600">{hint}</span>}
      </span>
    </button>
  );
}

export function StepHeader({ step, total, title, onBack }: { step: number; total: number; title: string; onBack?: () => void }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-2">
        {onBack ? (
          <button type="button" onClick={onBack} className="rounded-lg px-2 py-1 font-medium text-blue-700 hover:bg-blue-50">
            ← Back
          </button>
        ) : (
          <span />
        )}
        <span className="text-sm font-medium text-slate-500">
          Step {step} of {total}
        </span>
      </div>
      <h2 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">{title}</h2>
      <div className="mt-3 flex gap-1" aria-hidden>
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={cx("h-1.5 flex-1 rounded-full", i < step ? "bg-blue-600" : "bg-slate-200")} />
        ))}
      </div>
    </div>
  );
}

export const LIGHT_STYLES: Record<Light, { bg: string; text: string; ring: string; soft: string; label: string; word: string }> = {
  green: { bg: "bg-green-600", text: "text-white", ring: "ring-green-600", soft: "bg-green-50", label: "Come on in", word: "GREEN" },
  yellow: { bg: "bg-amber-400", text: "text-slate-950", ring: "ring-amber-400", soft: "bg-amber-50", label: "Expect a wait", word: "YELLOW" },
  red: { bg: "bg-red-600", text: "text-white", ring: "ring-red-600", soft: "bg-red-50", label: "Stop: full tonight", word: "RED" },
  none: { bg: "bg-slate-300", text: "text-slate-800", ring: "ring-slate-300", soft: "bg-slate-50", label: "No attorney yet", word: "GRAY" },
};

export function LightBadge({ light, className }: { light: Light; className?: string }) {
  const s = LIGHT_STYLES[light];
  return (
    <span className={cx("inline-flex items-center rounded-lg px-2.5 py-1 text-sm font-extrabold tracking-wide", s.bg, s.text, light === "red" && "animate-pulse", className)}>
      {s.word}
    </span>
  );
}

export function StatusPill({ status }: { status: "arrived" | "waiting" | "with_attorney" | "done" | "left" }) {
  const map = {
    arrived: ["On deck", "bg-sky-100 text-sky-900"],
    waiting: ["Waiting", "bg-amber-100 text-amber-900"],
    with_attorney: ["With attorney", "bg-violet-100 text-violet-900"],
    done: ["Done", "bg-green-100 text-green-900"],
    left: ["Left", "bg-slate-200 text-slate-700"],
  } as const;
  const [label, cls] = map[status];
  return <span className={cx("inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", cls)}>{label}</span>;
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
      <div className={cx("text-2xl font-bold tabular-nums", tone ?? "text-slate-900")}>{value}</div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
