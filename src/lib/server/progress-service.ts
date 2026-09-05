import { prisma } from "@/lib/db";
import type { ProgressMap } from "@/lib/progress";

/** Código legible para vincular dispositivos: 8 caracteres sin ambigüedades (sin 0/O, 1/I). */
export function newCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export interface AnswerInput {
  exerciseId: string;
  correct: boolean;
  streak: number;
  /** "2026-09-04", en la zona horaria del dispositivo */
  day: string;
  /** ISO */
  at: string;
}

const ID_RE = /^[a-z0-9-]{1,40}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isAnswer(x: unknown): x is AnswerInput {
  if (!x || typeof x !== "object") return false;
  const a = x as Record<string, unknown>;
  return (
    typeof a.exerciseId === "string" && ID_RE.test(a.exerciseId) &&
    typeof a.correct === "boolean" &&
    typeof a.streak === "number" && Number.isFinite(a.streak) &&
    typeof a.day === "string" && DAY_RE.test(a.day) &&
    typeof a.at === "string" && !Number.isNaN(Date.parse(a.at))
  );
}

/** Aplica respuestas acumulándolas sobre lo que ya hay. Idempotente por lote no, por eso el cliente vacía su cola al confirmar. */
export async function applyAnswers(profileId: string, answers: AnswerInput[]): Promise<void> {
  // Se agrupan para hacer una escritura por ejercicio y por día.
  const byExercise = new Map<string, { attempts: number; correct: number; bestStreak: number; last: Date }>();
  const byDay = new Map<string, { exerciseId: string; day: string; attempts: number; correct: number }>();
  for (const a of answers) {
    const ex = byExercise.get(a.exerciseId) ?? { attempts: 0, correct: 0, bestStreak: 0, last: new Date(0) };
    ex.attempts++;
    if (a.correct) ex.correct++;
    ex.bestStreak = Math.max(ex.bestStreak, Math.floor(a.streak));
    const at = new Date(a.at);
    if (at > ex.last) ex.last = at;
    byExercise.set(a.exerciseId, ex);

    const key = `${a.exerciseId}|${a.day}`;
    const d = byDay.get(key) ?? { exerciseId: a.exerciseId, day: a.day, attempts: 0, correct: 0 };
    d.attempts++;
    if (a.correct) d.correct++;
    byDay.set(key, d);
  }

  await prisma.$transaction(async (tx) => {
    for (const [exerciseId, ex] of byExercise) {
      const current = await tx.exerciseProgress.findUnique({ where: { profileId_exerciseId: { profileId, exerciseId } } });
      await tx.exerciseProgress.upsert({
        where: { profileId_exerciseId: { profileId, exerciseId } },
        create: { profileId, exerciseId, attempts: ex.attempts, correct: ex.correct, bestStreak: ex.bestStreak, lastPlayed: ex.last },
        update: {
          attempts: { increment: ex.attempts },
          correct: { increment: ex.correct },
          bestStreak: Math.max(current?.bestStreak ?? 0, ex.bestStreak),
          lastPlayed: current?.lastPlayed && current.lastPlayed > ex.last ? current.lastPlayed : ex.last,
        },
      });
    }
    for (const d of byDay.values()) {
      await tx.dailyActivity.upsert({
        where: { profileId_exerciseId_day: { profileId, exerciseId: d.exerciseId, day: d.day } },
        create: { profileId, exerciseId: d.exerciseId, day: d.day, attempts: d.attempts, correct: d.correct },
        update: { attempts: { increment: d.attempts }, correct: { increment: d.correct } },
      });
    }
  });
}

/** El progreso completo en la misma forma que usa el cliente. */
export async function progressMap(profileId: string): Promise<ProgressMap> {
  const [exercises, days] = await Promise.all([
    prisma.exerciseProgress.findMany({ where: { profileId } }),
    prisma.dailyActivity.findMany({ where: { profileId } }),
  ]);
  const map: ProgressMap = {};
  for (const e of exercises) {
    map[e.exerciseId] = {
      attempts: e.attempts,
      correct: e.correct,
      bestStreak: e.bestStreak,
      lastPlayed: e.lastPlayed?.toISOString() ?? "",
      days: {},
    };
  }
  for (const d of days) {
    const ex = (map[d.exerciseId] ??= { attempts: 0, correct: 0, bestStreak: 0, lastPlayed: "", days: {} });
    ex.days[d.day] = { attempts: d.attempts, correct: d.correct };
  }
  return map;
}
