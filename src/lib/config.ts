import type { PracticeArea } from "./types";

/**
 * PLACEHOLDER practice areas. VCLA has 12; LEAD is collecting the official
 * list. Replace these ids/names once it arrives (ids are stored in events, so
 * pick final ids before the first real clinic night).
 */
export const PRACTICE_AREAS: PracticeArea[] = [
  { id: "family", name: "Family Law", short: "Family" },
  { id: "housing", name: "Housing / Landlord-Tenant", short: "Housing" },
  { id: "immigration", name: "Immigration", short: "Immigration" },
  { id: "employment", name: "Employment", short: "Employment" },
  { id: "consumer", name: "Consumer & Debt", short: "Consumer" },
  { id: "estate", name: "Wills & Estate Planning", short: "Estate" },
  { id: "elder", name: "Elder Law", short: "Elder" },
  { id: "benefits", name: "Public Benefits", short: "Benefits" },
  { id: "record", name: "Record Clearing", short: "Record" },
  { id: "civil", name: "Small Claims / Civil", short: "Civil" },
  { id: "bankruptcy", name: "Bankruptcy", short: "Bankruptcy" },
  { id: "disability", name: "Disability Rights", short: "Disability" },
];

export const AREA_BY_ID: Record<string, PracticeArea> = Object.fromEntries(
  PRACTICE_AREAS.map((a) => [a.id, a]),
);

export const LANGUAGES = [
  "English",
  "Spanish",
  "Mandarin",
  "Cantonese",
  "Vietnamese",
  "Korean",
  "Tagalog",
  "Armenian",
  "Other",
];

/** Tunable thresholds. Expected to move into an admin settings screen. */
export const THRESHOLDS = {
  /** Used for wait estimates until 3+ sessions have finished tonight. */
  defaultSessionMins: 30,
  /** Estimated wait for a new arrival at or below this → green. */
  greenMaxWaitMins: 30,
  /** Estimated wait at or below this → yellow. Above → red. */
  yellowMaxWaitMins: 90,
  /** QA: someone has been waiting (form turned in) this long. */
  waitingWarnMins: 60,
  waitingCriticalMins: 90,
  /** QA: checked in but form not turned in after this long. */
  formNotInMins: 30,
  /** QA: an attorney session running this long. */
  sessionLongMins: 60,
  /** Default closing time for a new clinic night (24h clock). */
  defaultCloseHour: 20,
  defaultCloseMinute: 30,
};
