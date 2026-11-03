/**
 * Domain types for the VCLA clinic-night app.
 *
 * The app is event-sourced: every button press in a station screen becomes one
 * immutable `ClinicEvent`. Current state (who is waiting, who is with whom) is
 * always *derived* by replaying events. Nothing ever "writes over itself" the
 * way spreadsheet cells did, every change is auditable, and Undo is just
 * "ignore the last event".
 */

export type Station = "entrance" | "nerve-center" | "front-desk" | "dashboard" | "system";

/** arrived ("on deck") → waiting (form turned in) → with_attorney → done, or left at any point. */
export type ClientStatus = "arrived" | "waiting" | "with_attorney" | "done" | "left";

export type AttorneyStatus = "available" | "in_session" | "checked_out";

export interface PracticeArea {
  id: string;
  name: string;
  short: string;
}

/** One entry on the clinic's standing volunteer list (~100 people). */
export interface RosterAttorney {
  id: string;
  name: string;
  practiceAreaIds: string[];
  spanish: boolean;
}

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  practiceAreaId: string;
  language: string;
  /** How staff find the person in the room: "red sweater, Dodgers cap". */
  description: string;
  status: ClientStatus;
  arrivedAt: number;
  /** When the intake form was turned in. Queue order is by this time. */
  waitingAt?: number;
  sessionStartedAt?: number;
  finishedAt?: number;
  leftAt?: number;
  leftFrom?: ClientStatus;
  attorneyId?: string;
}

export interface AttorneyOnSite {
  id: string;
  name: string;
  practiceAreaIds: string[];
  spanish: boolean;
  walkIn: boolean;
  checkedInAt: number;
  checkedOutAt?: number;
  /** Optional: when the attorney said they need to leave. */
  leaveBy?: number;
  status: AttorneyStatus;
  currentClientId?: string;
  currentSessionId?: string;
  clientsSeen: number;
}

export interface Session {
  id: string;
  clientId: string;
  attorneyId: string;
  startedAt: number;
  endedAt?: number;
  outcome?: "done" | "client_left";
}

export interface Clinic {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  openedAt: number;
  closesAt: number;
}

export type EventBody =
  | {
      type: "client_checked_in";
      clientId: string;
      firstName: string;
      lastName: string;
      practiceAreaId: string;
      language: string;
      description: string;
    }
  | { type: "form_turned_in"; clientId: string }
  | { type: "session_started"; sessionId: string; clientId: string; attorneyId: string }
  | { type: "session_ended"; sessionId: string; attorneyContinues: boolean }
  | { type: "client_left"; clientId: string }
  | {
      type: "client_updated";
      clientId: string;
      practiceAreaId?: string;
      description?: string;
      language?: string;
    }
  | {
      type: "attorney_checked_in";
      attorneyId: string;
      name: string;
      practiceAreaIds: string[];
      spanish: boolean;
      leaveBy?: number;
      walkIn?: boolean;
    }
  | { type: "attorney_checked_out"; attorneyId: string }
  | { type: "area_override"; practiceAreaId: string; closed: boolean };

export type ClinicEvent = EventBody & {
  id: string;
  at: number;
  station: Station;
  /** Undone events stay in the log for the audit trail but are skipped on replay. */
  undone?: boolean;
};

export interface ClinicState {
  clients: Record<string, Client>;
  /** Client ids in check-in order. */
  clientOrder: string[];
  attorneys: Record<string, AttorneyOnSite>;
  sessions: Record<string, Session>;
  /** Practice areas staff have manually closed ("no more housing tonight"). */
  closedAreas: Record<string, boolean>;
}

export type Light = "green" | "yellow" | "red" | "none";

export interface AreaSnapshot {
  area: PracticeArea;
  light: Light;
  reason: string;
  attorneysHere: number;
  attorneysFree: number;
  attorneysBusy: number;
  waiting: Client[];
  onDeck: Client[];
  withAttorney: Client[];
  /** Estimated minutes until a client who walks in now would be seen. null = not before close. */
  estWaitNewMins: number | null;
  /** Estimated start time for each waiting client, by client id. */
  estStartById: Record<string, number | null>;
  closedByStaff: boolean;
}

export type AlertSeverity = "critical" | "warning" | "info";

export interface QaAlert {
  id: string;
  severity: AlertSeverity;
  message: string;
  clientId?: string;
  attorneyId?: string;
}

export interface NightSummary {
  clinicId: string;
  date: string;
  openedAt: number;
  closedAt: number;
  clientsCheckedIn: number;
  clientsServed: number;
  clientsLeft: number;
  attorneyIds: string[];
  attorneyNames: string[];
  avgWaitMins: number | null;
  avgSessionMins: number | null;
  byArea: Record<string, { served: number; left: number; checkedIn: number }>;
}
