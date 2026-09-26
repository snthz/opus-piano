import { describe, expect, test } from "bun:test";
import { dayStreak, summarize, todayKey, type ProgressMap } from "@/lib/progress";

const key = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return todayKey(d);
};

describe("resumen del progreso en el cliente", () => {
  test("todayKey usa la fecha local con ceros a la izquierda", () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  test("summarize suma intentos y aciertos y cuenta días distintos", () => {
    const p: ProgressMap = {
      notas: { attempts: 10, correct: 8, bestStreak: 5, lastPlayed: "", days: { "2026-09-01": { attempts: 4, correct: 3 }, "2026-09-02": { attempts: 6, correct: 5 } } },
      ritmo: { attempts: 2, correct: 1, bestStreak: 1, lastPlayed: "", days: { "2026-09-02": { attempts: 2, correct: 1 } } },
    };
    expect(summarize(p)).toEqual({ attempts: 12, correct: 9, days: 2, accuracy: 75 });
    expect(summarize({})).toEqual({ attempts: 0, correct: 0, days: 0, accuracy: 0 });
  });

  test("dayStreak cuenta días seguidos y admite que hoy aún no se haya practicado", () => {
    const withToday: ProgressMap = { notas: { attempts: 3, correct: 3, bestStreak: 3, lastPlayed: "", days: { [key(0)]: { attempts: 1, correct: 1 }, [key(1)]: { attempts: 1, correct: 1 }, [key(2)]: { attempts: 1, correct: 1 } } } };
    expect(dayStreak(withToday)).toBe(3);
    const untilYesterday: ProgressMap = { notas: { attempts: 2, correct: 2, bestStreak: 2, lastPlayed: "", days: { [key(1)]: { attempts: 1, correct: 1 }, [key(2)]: { attempts: 1, correct: 1 } } } };
    expect(dayStreak(untilYesterday)).toBe(2);
    const broken: ProgressMap = { notas: { attempts: 1, correct: 1, bestStreak: 1, lastPlayed: "", days: { [key(3)]: { attempts: 1, correct: 1 } } } };
    expect(dayStreak(broken)).toBe(0);
  });

  test("dayStreak suma los días de estudio comprobado a los de ejercicios", () => {
    const exercises: ProgressMap = { notas: { attempts: 1, correct: 1, bestStreak: 1, lastPlayed: "", days: { [key(0)]: { attempts: 1, correct: 1 } } } };
    expect(dayStreak(exercises, [key(1), key(2)])).toBe(3);
    expect(dayStreak({}, [key(0), key(1)])).toBe(2);
  });
});
