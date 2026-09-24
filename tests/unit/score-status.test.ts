import { describe, expect, test } from "bun:test";
import { scoreStatus, sortByStatus } from "@/lib/score-status";

describe("estado de las partituras", () => {
  test("sin estado guardado: con plan es «en estudio», sin plan «por empezar»", () => {
    expect(scoreStatus({})).toBe("pending");
    expect(scoreStatus({ plan: { anything: true } })).toBe("studying");
    expect(scoreStatus({ status: "learned", plan: {} })).toBe("learned");
    expect(scoreStatus({ status: null })).toBe("pending");
  });

  test("la biblioteca ordena por estado y, dentro de cada uno, la más nueva primero", () => {
    const sorted = sortByStatus([
      { id: "old-pending", addedAt: 1 },
      { id: "learned", status: "learned" as const, addedAt: 9 },
      { id: "new-pending", addedAt: 5 },
      { id: "studying", status: "studying" as const, addedAt: 2 },
    ]);
    expect(sorted.map((s) => s.id)).toEqual(["studying", "new-pending", "old-pending", "learned"]);
  });
});
