import type { RosterAttorney } from "./types";

/**
 * SAMPLE volunteer list with made-up names. The real list (~100 attorneys,
 * each with their practice areas and whether they speak Spanish) comes from
 * VCLA; in production this lives in the database and is edited on an admin
 * screen, not in code.
 */
export const SAMPLE_ROSTER: RosterAttorney[] = [
  { id: "a01", name: "Avery Lindqvist", practiceAreaIds: ["family"], spanish: true },
  { id: "a02", name: "Blake Okafor", practiceAreaIds: ["housing", "consumer"], spanish: false },
  { id: "a03", name: "Carmen Ruiz-Tanaka", practiceAreaIds: ["immigration"], spanish: true },
  { id: "a04", name: "Dana Whitfield", practiceAreaIds: ["family", "estate"], spanish: false },
  { id: "a05", name: "Eli Brandvold", practiceAreaIds: ["employment"], spanish: false },
  { id: "a06", name: "Farah Castellanos", practiceAreaIds: ["housing"], spanish: true },
  { id: "a07", name: "Gideon Marsh", practiceAreaIds: ["estate", "elder"], spanish: false },
  { id: "a08", name: "Hana Szabo", practiceAreaIds: ["benefits", "disability"], spanish: false },
  { id: "a09", name: "Iris Delacroix", practiceAreaIds: ["record"], spanish: true },
  { id: "a10", name: "Jules Amari", practiceAreaIds: ["civil", "consumer"], spanish: false },
  { id: "a11", name: "Kendall Moreau", practiceAreaIds: ["bankruptcy", "consumer"], spanish: false },
  { id: "a12", name: "Lena Vasquez-Holt", practiceAreaIds: ["family"], spanish: true },
  { id: "a13", name: "Marcus Ellery", practiceAreaIds: ["employment", "civil"], spanish: false },
  { id: "a14", name: "Nadia Quill", practiceAreaIds: ["immigration", "family"], spanish: true },
  { id: "a15", name: "Oscar Bellweather", practiceAreaIds: ["elder", "benefits"], spanish: false },
  { id: "a16", name: "Priya Hartono", practiceAreaIds: ["housing"], spanish: false },
  { id: "a17", name: "Quentin Abara", practiceAreaIds: ["record", "civil"], spanish: false },
  { id: "a18", name: "Rosa Etxeberria", practiceAreaIds: ["benefits"], spanish: true },
  { id: "a19", name: "Sasha Nkemelu", practiceAreaIds: ["disability", "employment"], spanish: false },
  { id: "a20", name: "Tomas Greer", practiceAreaIds: ["estate"], spanish: true },
  { id: "a21", name: "Uma Calloway", practiceAreaIds: ["bankruptcy"], spanish: false },
  { id: "a22", name: "Victor Ilunga", practiceAreaIds: ["family", "housing"], spanish: false },
  { id: "a23", name: "Wren Takahashi", practiceAreaIds: ["consumer"], spanish: false },
  { id: "a24", name: "Ximena Paredes", practiceAreaIds: ["immigration", "employment"], spanish: true },
];
