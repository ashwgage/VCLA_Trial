/**
 * Builds a believable mid-evening clinic night for demos: ~30 clients, 9
 * attorneys, one overloaded practice area, one uncovered area, and a few
 * people the QA checks should flag. All names are made up.
 */
import { SAMPLE_ROSTER } from "./roster";
import { apply, emptyState } from "./engine";
import type { Clinic, ClinicEvent, EventBody, NightSummary } from "./types";

const MIN = 60_000;

type Op = { at: number; body: EventBody; station: ClinicEvent["station"] };

export function buildSampleNight(now: number): { clinic: Clinic; events: ClinicEvent[]; history: NightSummary[] } {
  const d = new Date(now);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const clinic: Clinic = { id: `sample-${now}`, date, openedAt: now - 160 * MIN, closesAt: now + 80 * MIN };
  const ops: Op[] = [];
  const t = (minsAgo: number) => now - minsAgo * MIN;
  const roster = Object.fromEntries(SAMPLE_ROSTER.map((r) => [r.id, r]));

  const att = (ago: number, id: string, leaveByFromNow?: number) => {
    const r = roster[id];
    ops.push({
      at: t(ago),
      station: "front-desk",
      body: {
        type: "attorney_checked_in",
        attorneyId: id,
        name: r.name,
        practiceAreaIds: r.practiceAreaIds,
        spanish: r.spanish,
        leaveBy: leaveByFromNow === undefined ? undefined : now + leaveByFromNow * MIN,
      },
    });
  };
  const cin = (ago: number, key: string, first: string, last: string, area: string, description: string, language = "English") =>
    ops.push({
      at: t(ago),
      station: "entrance",
      body: { type: "client_checked_in", clientId: `s-${key}`, firstName: first, lastName: last, practiceAreaId: area, language, description },
    });
  const form = (ago: number, key: string) =>
    ops.push({ at: t(ago), station: "nerve-center", body: { type: "form_turned_in", clientId: `s-${key}` } });
  const start = (ago: number, key: string, attorneyId: string) =>
    ops.push({ at: t(ago), station: "nerve-center", body: { type: "session_started", sessionId: `ss-${key}`, clientId: `s-${key}`, attorneyId } });
  const end = (ago: number, key: string, attorneyContinues = true) =>
    ops.push({ at: t(ago), station: "nerve-center", body: { type: "session_ended", sessionId: `ss-${key}`, attorneyContinues } });
  const left = (ago: number, key: string) =>
    ops.push({ at: t(ago), station: "front-desk", body: { type: "client_left", clientId: `s-${key}` } });

  // Attorneys
  att(140, "a01");
  att(120, "a12");
  att(110, "a04", -5); // said they'd leave 5 minutes ago → QA flag
  att(130, "a02");
  att(135, "a03");
  att(100, "a05");
  att(90, "a07");
  att(125, "a11");
  att(95, "a09");

  // Family: well staffed → green
  cin(150, "f1", "Marisol", "Achebe", "family", "red sweater", "Spanish");
  form(130, "f1"); start(100, "f1", "a01"); end(70, "f1");
  cin(140, "f2", "Dev", "Kowalczyk", "family", "Dodgers cap, black sweats");
  form(120, "f2"); start(95, "f2", "a12"); end(60, "f2");
  cin(90, "f3", "Tamsin", "Oyelaran", "family", "green jacket");
  form(70, "f3"); start(40, "f3", "a01");
  cin(25, "f4", "Ruben", "Halvorsen", "family", "gray hoodie, backpack", "Spanish");
  form(15, "f4");

  // Housing: one attorney, long line → red, plus a 95+ minute wait
  cin(150, "h1", "Gloria", "Fenwick", "housing", "yellow scarf");
  form(135, "h1"); start(110, "h1", "a02"); end(80, "h1");
  cin(145, "h2", "Abdi", "Lancaster", "housing", "blue denim jacket");
  form(128, "h2"); start(78, "h2", "a02"); end(45, "h2");
  cin(140, "h3", "Noor", "Brightwater", "housing", "with toddler, gray stroller");
  form(105, "h3"); start(43, "h3", "a02");
  cin(110, "h4", "Earl", "Mbatha", "housing", "walker, purple coat");
  form(97, "h4");
  cin(90, "h5", "Lucia", "Sandoval", "housing", "glasses, plaid shirt", "Spanish");
  form(80, "h5");
  cin(60, "h6", "Petra", "Ovalle", "housing", "white Lakers jersey", "Spanish");
  form(50, "h6");
  cin(20, "h7", "Hollis", "Grange", "housing", "orange beanie");
  cin(12, "h8", "Yusuf", "Delgado", "housing", "brown leather jacket");
  form(5, "h8");

  // Immigration: one attorney, short line → yellow
  cin(140, "i1", "Jae", "Moon", "immigration", "floral dress", "Korean");
  form(120, "i1"); start(105, "i1", "a03"); end(75, "i1");
  cin(120, "i2", "Esteban", "Rivas", "immigration", "navy suit jacket", "Spanish");
  form(100, "i2"); start(70, "i2", "a03"); end(35, "i2");
  cin(80, "i3", "Amara", "Diallo", "immigration", "camo cap");
  form(60, "i3"); start(30, "i3", "a03");
  cin(55, "i4", "Graciela", "Montoya", "immigration", "pink backpack", "Spanish");
  form(45, "i4");
  cin(35, "i5", "Thanh", "Nguyen", "immigration", "black puffer coat", "Vietnamese");
  form(28, "i5");

  // Employment: free attorney; one client never turned in a form → QA flag
  cin(120, "em1", "Rhonda", "Pike", "employment", "maroon cardigan");
  form(95, "em1"); start(90, "em1", "a05"); end(60, "em1");
  cin(42, "em2", "Felix", "Arceneaux", "employment", "striped shirt, headphones");

  // Estate: one session running long → QA flag
  cin(130, "e1", "Beatrice", "Lund", "estate", "tan trench coat");
  form(100, "e1"); start(85, "e1", "a04"); end(50, "e1");
  cin(100, "e2", "Walter", "Osei", "estate", "cane, gray fedora");
  form(85, "e2"); start(75, "e2", "a07");

  // Bankruptcy / consumer: attorney went home after their last client
  cin(125, "b1", "Imelda", "Ross", "bankruptcy", "bright green sneakers");
  form(110, "b1"); start(100, "b1", "a11"); end(70, "b1");
  cin(100, "c1", "Corey", "Vance", "consumer", "denim overalls");
  form(80, "c1"); start(65, "c1", "a11"); end(42, "c1", false);
  cin(50, "c2", "Mina", "Farouk", "consumer", "USC sweatshirt");
  form(40, "c2");

  // Record clearing: one done, one left for the bus
  cin(90, "r1", "Darnell", "Price", "record", "red rain jacket");
  form(75, "r1"); start(60, "r1", "a09"); end(30, "r1");
  cin(70, "r2", "Shay", "Okoro", "record", "white headscarf");
  left(50, "r2");

  // Uncovered areas → red + critical QA
  cin(45, "bn1", "Agnes", "Kim", "benefits", "hi-vis work vest");
  form(35, "bn1");
  cin(15, "cv1", "Rafael", "Ortiz", "civil", "corduroy jacket", "Spanish");

  // Elder: waited, then left
  cin(65, "el1", "Harold", "Wexler", "elder", "teal fleece");
  form(55, "el1"); left(20, "el1");

  ops.sort((a, b) => a.at - b.at);
  let state = emptyState();
  const events: ClinicEvent[] = ops.map((op, i) => {
    const ev = { ...op.body, id: `se${i}`, at: op.at, station: op.station } as ClinicEvent;
    const next = apply(state, ev);
    if (next === state && process.env.NODE_ENV !== "production") console.warn("Sample event rejected", ev);
    state = next;
    return ev;
  });

  return { clinic, events, history: sampleHistory(now) };
}

function sampleHistory(now: number): NightSummary[] {
  const nights = [
    { daysAgo: 14, served: 31, left: 4, attorneys: ["a01", "a02", "a03", "a05", "a06", "a08", "a12", "a14", "a16", "a20"], wait: 48, session: 29 },
    { daysAgo: 28, served: 27, left: 6, attorneys: ["a01", "a03", "a04", "a07", "a09", "a10", "a13", "a18", "a22"], wait: 62, session: 33 },
    { daysAgo: 42, served: 35, left: 3, attorneys: ["a02", "a03", "a05", "a06", "a11", "a12", "a15", "a17", "a19", "a21", "a24"], wait: 41, session: 27 },
    { daysAgo: 56, served: 24, left: 5, attorneys: ["a01", "a02", "a08", "a12", "a14", "a23"], wait: 55, session: 31 },
  ];
  const areaIds = ["family", "housing", "immigration", "employment", "consumer", "estate", "elder", "benefits", "record", "civil", "bankruptcy", "disability"];
  const weights = [7, 8, 5, 3, 3, 2, 1, 2, 2, 1, 1, 1];
  return nights.map((n, idx) => {
    const day = new Date(now - n.daysAgo * 86_400_000);
    day.setHours(17, 30, 0, 0);
    const total = n.served + n.left;
    const wsum = weights.reduce((a, b) => a + b, 0);
    const byArea: NightSummary["byArea"] = {};
    let servedLeft = n.served;
    let leftLeft = n.left;
    areaIds.forEach((id, i) => {
      const served = i === areaIds.length - 1 ? servedLeft : Math.min(servedLeft, Math.round((n.served * weights[i]) / wsum));
      const left = i === areaIds.length - 1 ? leftLeft : Math.min(leftLeft, (i + idx) % 4 === 0 ? 1 : 0);
      servedLeft -= served;
      leftLeft -= left;
      if (served + left > 0) byArea[id] = { served, left, checkedIn: served + left };
    });
    const names = Object.fromEntries(SAMPLE_ROSTER.map((r) => [r.id, r.name]));
    return {
      clinicId: `sample-hist-${idx}`,
      date: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`,
      openedAt: day.getTime(),
      closedAt: day.getTime() + 3.25 * 3600_000,
      clientsCheckedIn: total,
      clientsServed: n.served,
      clientsLeft: n.left,
      attorneyIds: n.attorneys,
      attorneyNames: n.attorneys.map((a) => names[a]),
      avgWaitMins: n.wait,
      avgSessionMins: n.session,
      byArea,
    };
  });
}
