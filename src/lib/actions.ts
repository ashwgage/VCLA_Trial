"use client";

import { dispatch } from "./store";
import { notify } from "./toast";
import type { EventBody, Station } from "./types";

/** Dispatch + show a toast with Undo (success) or the plain-language reason (failure). */
export function act(body: EventBody, station: Station): boolean {
  const res = dispatch(body, station);
  if (res.ok) notify({ tone: "success", message: res.message, undoEventId: res.event.id });
  else notify({ tone: "error", message: res.error });
  return res.ok;
}
