import { z } from "zod";
import type { Goal, PlanState, StudyPlan } from "@/lib/study-plan";

/**
 * Study agenda: what days and time each score gets studied.
 *
 * No session is stored here. The schedule (weekdays, time, start date) is
 * saved with the plan, and sessions are derived from it plus the plan's
 * goals, which already carry each one's estimated session count. That way
 * the calendar can never contradict the plan.
 *
 * Everything here is deterministic and works with local dates
 * ("2026-09-08"), never UTC — a Monday-night session shouldn't show up on
 * Tuesday because of a timezone shift.
 */

/* ---------- Days and times ---------- */

/** Indices as returned by `Date.getDay()`: 0 = Sunday. */
export const WEEKDAY_LETTERS = ["D", "L", "M", "X", "J", "V", "S"] as const;
export const WEEKDAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;

/** Local date as "YYYY-MM-DD"; `toISOString` goes through UTC and can shift the day. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local midnight for the given day; `new Date("2026-09-08")` would be UTC midnight. */
export function parseDay(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

/** Monday of that date's week (weeks start on Monday here). */
export function startOfWeek(d: Date): Date {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

/** Adds minutes to an "HH:MM" time; clamps to 23:59 past midnight instead of wrapping. */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + minutes;
  if (total >= 24 * 60) return "23:59";
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/* ---------- The schedule saved with the plan ---------- */

export const scheduleSchema = z.object({
  /** Weekdays with a session (0 = Sunday). */
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  /** Local start time, "HH:MM". */
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  /** First day counted when spreading sessions, "YYYY-MM-DD". */
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minutes: z.number().int().min(5).max(240),
  /** Days marked as studied: { "2026-09-10": true } */
  done: z.record(z.string().max(10), z.boolean()),
  /**
   * Goals no longer taking a calendar slot. Filled in by "Replan from today"
   * with whatever was already done, so the rest spreads from the new date
   * instead of dragging the delay.
   */
  skip: z.array(z.string().max(20)).max(30),
});
export type Schedule = z.infer<typeof scheduleSchema>;

/** Suggested days for someone studying N days/week; editable in the form. */
const WEEKDAY_PRESETS: Record<number, number[]> = {
  1: [6],
  2: [2, 5],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

export function defaultSchedule(daysPerWeek: number, minutes: number, today = new Date()): Schedule {
  const days = Math.max(1, Math.min(7, Math.round(daysPerWeek)));
  return {
    weekdays: WEEKDAY_PRESETS[days] ?? WEEKDAY_PRESETS[3],
    time: "18:00",
    startDate: dayKey(today),
    minutes: Math.max(5, Math.min(240, minutes)),
    done: {},
    skip: [],
  };
}

/** e.g. "Lunes, miércoles y viernes a las 18:00". */
export function describeSchedule(s: Schedule): string {
  const names = [...s.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEKDAY_NAMES[d]);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
  return `${list.charAt(0).toUpperCase()}${list.slice(1)} a las ${s.time}`;
}

/* ---------- From the plan's goals to the calendar's sessions ---------- */

export interface Session {
  /** Session number within the plan, starting at 1. */
  index: number;
  /** Local date "YYYY-MM-DD". */
  day: string;
  time: string;
  minutes: number;
  goal: Goal;
  /** Which session of that goal this is, and how many it has in total. */
  ofGoal: { n: number; total: number };
  done: boolean;
}

/**
 * Caps on the spread. A normal plan has 5-9 goals of 2-5 sessions each; these
 * limits exist so a bogus `sessions` value from the model can't generate
 * years of calendar, not to trim real plans.
 */
const MAX_SESSIONS_PER_GOAL = 30;
export const MAX_SESSIONS = 200;

/**
 * Spreads the plan's goals across the schedule's days in order: each goal
 * takes as many consecutive sessions as it estimates, landing on the next
 * chosen weekday from `startDate`.
 *
 * `progress` marks a goal's session as done once the goal itself is done, so
 * the plan and the agenda never disagree.
 */
export function planSessions(plan: StudyPlan, schedule: Schedule, progress: Record<string, boolean> = {}): Session[] {
  const skipped = new Set(schedule.skip);
  const slots: { goal: Goal; n: number; total: number }[] = [];
  for (const goal of plan.goals) {
    if (skipped.has(goal.id)) continue;
    const total = Math.max(1, Math.min(goal.sessions, MAX_SESSIONS_PER_GOAL));
    for (let n = 1; n <= total && slots.length < MAX_SESSIONS; n++) slots.push({ goal, n, total });
  }

  const weekdays = new Set(schedule.weekdays);
  const sessions: Session[] = [];
  const cursor = parseDay(schedule.startDate);
  // guard in case `weekdays` came out empty from corrupt data
  for (let guard = 0; guard < MAX_SESSIONS * 7 + 7 && sessions.length < slots.length; guard++) {
    if (weekdays.has(cursor.getDay())) {
      const slot = slots[sessions.length];
      const day = dayKey(cursor);
      sessions.push({
        index: sessions.length + 1,
        day,
        time: schedule.time,
        minutes: schedule.minutes,
        goal: slot.goal,
        ofGoal: { n: slot.n, total: slot.total },
        done: !!schedule.done[day] || !!progress[slot.goal.id],
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return sessions;
}

/** Routine blocks with their clock time, to see the session spread across the hour. */
export function sessionBlocks(plan: StudyPlan, session: Session): { from: string; to: string; minutes: number; activity: string }[] {
  let offset = 0;
  return plan.routine.blocks.map((b) => {
    const from = addMinutes(session.time, offset);
    offset += Math.max(0, b.minutes);
    return { from, to: addMinutes(session.time, offset), minutes: b.minutes, activity: b.activity };
  });
}

/* ---------- The full agenda: every scheduled score ---------- */

/** What the agenda needs from a score; keeps it independent of IndexedDB and testable. */
export interface ScheduledScore {
  id: string;
  name: string;
  plan?: PlanState;
}

export interface AgendaEntry {
  score: { id: string; name: string };
  plan: StudyPlan;
  schedule: Schedule;
  session: Session;
}

/** All sessions from all scheduled scores, grouped by day. */
export function agendaByDay(scores: ScheduledScore[]): Map<string, AgendaEntry[]> {
  const byDay = new Map<string, AgendaEntry[]>();
  for (const score of scores) {
    const state = score.plan;
    if (!state?.schedule) continue;
    for (const session of planSessions(state.plan, state.schedule, state.progress)) {
      const entry: AgendaEntry = {
        score: { id: score.id, name: score.name },
        plan: state.plan,
        schedule: state.schedule,
        session,
      };
      const list = byDay.get(session.day);
      if (list) list.push(entry);
      else byDay.set(session.day, [entry]);
    }
  }
  // multiple scores on the same day: keep them in the order they're studied
  for (const list of byDay.values()) list.sort((a, b) => a.session.time.localeCompare(b.session.time));
  return byDay;
}

/** First unstudied session from today on; what the agenda shows when there's nothing today. */
export function nextSession(byDay: Map<string, AgendaEntry[]>, from = dayKey(new Date())): AgendaEntry | null {
  let best: AgendaEntry | null = null;
  for (const [day, list] of byDay) {
    if (day < from) continue;
    for (const entry of list) {
      if (entry.session.done) continue;
      if (!best || day < best.session.day || (day === best.session.day && entry.session.time < best.session.time)) best = entry;
    }
  }
  return best;
}
