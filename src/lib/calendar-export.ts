import { addMinutes, type AgendaEntry } from "@/lib/agenda";
import { goalRange } from "@/lib/study-plan";

/**
 * The study sessions as a calendar file (.ics).
 *
 * A reminder has to arrive with the app closed, and a web app can only do
 * that with push notifications: a server, keys, subscriptions — machinery
 * that would have to be maintained forever so as to say "it's six o'clock".
 * The device already has something that does exactly this and works offline,
 * on any phone: its calendar. So the sessions are handed over to it, each one
 * with an alarm.
 *
 * Times are written without a time zone ("floating"): a session at six is at
 * six wherever the student is, which is what a study schedule means.
 */

/** Minutes before the session that the alarm goes off. */
const ALARM_MINUTES = 10;
/** A session with no time set lands here, as an ordinary event rather than all day. */
const DEFAULT_TIME = "18:00";

/** RFC 5545 escaping: backslash, semicolon, comma and line breaks. */
function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 octets are folded with a leading space on the rest. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) parts.push(" " + line.slice(i, i + 74));
  return parts.join("\r\n");
}

const stamp = (date: Date) => `${date.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;

/** "2026-09-11" + "18:00" → "20260911T180000" (local, no zone). */
const local = (day: string, time: string) => `${day.replace(/-/g, "")}T${time.replace(":", "")}00`;

export interface IcsOptions {
  /** For the UID, so two calendars of the same sessions don't collide. */
  domain?: string;
  /** Injectable so the test doesn't depend on the clock. */
  now?: Date;
}

export function sessionsToIcs(entries: AgendaEntry[], options: IcsOptions = {}): string {
  const { domain = "opuspiano.app", now = new Date() } = options;
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Opus Piano//Sesiones de estudio//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Opus Piano",
  ];

  for (const entry of entries) {
    const { session } = entry;
    const time = session.time ?? DEFAULT_TIME;
    const range = goalRange(session.goal);
    const description = [
      session.goal.title,
      range,
      session.goal.targetTempo,
      `Sesión ${session.ofGoal.n} de ${session.ofGoal.total} de este objetivo.`,
    ]
      .filter(Boolean)
      .join("\n");

    lines.push(
      "BEGIN:VEVENT",
      // Same session, same UID: importing twice updates instead of duplicating.
      `UID:${entry.score.id}-${session.day}@${domain}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${local(session.day, time)}`,
      `DTEND:${local(session.day, addMinutes(time, session.minutes))}`,
      fold(`SUMMARY:${escapeText(`Piano: ${entry.score.name}`)}`),
      fold(`DESCRIPTION:${escapeText(description)}`),
      "BEGIN:VALARM",
      `TRIGGER:-PT${ALARM_MINUTES}M`,
      "ACTION:DISPLAY",
      fold(`DESCRIPTION:${escapeText(`Estudio de piano: ${entry.score.name}`)}`),
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

/** Everything still to study, which is what's worth putting on a calendar. */
export function pendingEntries(byDay: Map<string, AgendaEntry[]>, from: string): AgendaEntry[] {
  const out: AgendaEntry[] = [];
  for (const [day, list] of byDay) {
    if (day < from) continue;
    for (const entry of list) if (!entry.session.done) out.push(entry);
  }
  return out.sort((a, b) => (a.session.day < b.session.day ? -1 : a.session.day > b.session.day ? 1 : 0));
}
