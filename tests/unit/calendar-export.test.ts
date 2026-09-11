/**
 * El archivo de calendario con el que el móvil recuerda las sesiones. Lo
 * importante es que cada sesión sea un evento con su hora local, su alarma y
 * un identificador estable: importarlo dos veces no puede duplicar nada.
 */
import { describe, expect, test } from "bun:test";
import { pendingEntries, sessionsToIcs } from "@/lib/calendar-export";
import type { AgendaEntry } from "@/lib/agenda";
import type { Goal, StudyPlan } from "@/lib/study-plan";

const goal: Goal = {
  id: "g1",
  title: "Compases 1-8, mano derecha",
  from: 1,
  to: 8,
  hands: "derecha",
  description: "",
  tips: [],
  fingering: "",
  targetTempo: "♩ = 72",
  sessions: 2,
};

const plan = { goals: [goal] } as unknown as StudyPlan;

const entry = (day: string, name = "Für Elise", time: string | null = "18:00", done = false): AgendaEntry => ({
  score: { id: "s1", name },
  plan,
  schedule: { weekdays: [1], time, startDate: day, minutes: 30, done: {}, skip: [] },
  session: { index: 1, day, time, minutes: 30, goal, ofGoal: { n: 1, total: 2 }, done },
});

const NOW = new Date("2026-09-11T10:00:00Z");

describe("sessionsToIcs", () => {
  const ics = sessionsToIcs([entry("2026-09-14")], { now: NOW });

  test("es un calendario con un evento", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  test("la hora es local, sin zona: a las seis es a las seis estés donde estés", () => {
    expect(ics).toContain("DTSTART:20260914T180000");
    expect(ics).toContain("DTEND:20260914T183000");
    expect(ics).not.toContain("DTSTART:20260914T180000Z");
  });

  test("cada sesión trae su alarma", () => {
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("TRIGGER:-PT10M");
  });

  test("el identificador es estable: reimportar actualiza, no duplica", () => {
    expect(ics).toContain("UID:s1-2026-09-14@opuspiano.app");
    expect(sessionsToIcs([entry("2026-09-14")], { now: new Date() })).toContain("UID:s1-2026-09-14@opuspiano.app");
  });

  test("el evento dice de qué va la sesión", () => {
    expect(ics).toContain("SUMMARY:Piano: Für Elise");
    expect(ics).toContain("Compases 1-8");
    expect(ics).toContain("Sesión 1 de 2");
  });

  test("una sesión sin hora cae a una hora razonable en vez de a medianoche", () => {
    expect(sessionsToIcs([entry("2026-09-14", "Für Elise", null)], { now: NOW })).toContain("DTSTART:20260914T180000");
  });

  test("las comas y los puntos y coma del nombre no rompen el archivo", () => {
    const tricky = sessionsToIcs([entry("2026-09-14", "Vals, op. 64; n.º 2")], { now: NOW });
    expect(tricky).toContain("SUMMARY:Piano: Vals\\, op. 64\\; n.º 2");
  });

  test("las líneas largas se parten como manda el formato", () => {
    const long = sessionsToIcs([entry("2026-09-14", "x".repeat(200))], { now: NOW });
    for (const line of long.split("\r\n")) expect(line.length).toBeLessThanOrEqual(75);
  });

  test("sin sesiones sigue siendo un calendario válido", () => {
    expect(sessionsToIcs([], { now: NOW })).toContain("END:VCALENDAR");
  });
});

describe("pendingEntries", () => {
  const byDay = new Map([
    ["2026-09-10", [entry("2026-09-10")]],
    ["2026-09-14", [entry("2026-09-14"), entry("2026-09-14", "Gymnopédie")]],
    ["2026-09-16", [entry("2026-09-16", "Für Elise", "18:00", true)]],
  ]);

  test("solo lo que queda por estudiar, de hoy en adelante y en orden", () => {
    const list = pendingEntries(byDay, "2026-09-11");
    expect(list.map((e) => `${e.session.day}/${e.score.name}`)).toEqual([
      "2026-09-14/Für Elise",
      "2026-09-14/Gymnopédie",
    ]);
  });

  test("desde antes, entra también lo pasado que no se hizo", () => {
    expect(pendingEntries(byDay, "2026-09-01")).toHaveLength(3);
  });
});
