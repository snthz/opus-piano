import { describe, expect, test } from "bun:test";
import { ROUTE_TEMPLATES } from "@/data/route-templates";
import { pieceById } from "@/data/catalog";
import {
  currentPiece,
  forgetScore,
  goalsByHorizon,
  importedRouteSchema,
  movePiece,
  newPiece,
  newRoute,
  routeDocument,
  routeFromImport,
  routeProgress,
  setPieceDone,
  studyRouteSchema,
} from "@/lib/study-route";

const piece = (id: string, kind: "core" | "side" = "core", done = false) => newPiece({ id, title: `Pieza ${id}`, kind, done });

describe("ruta de estudio", () => {
  test("la pieza en curso es la primera obligatoria sin terminar; las de gusto no cuentan", () => {
    const r = newRoute({ name: "R", pieces: [piece("s", "side"), piece("a", "core", true), piece("b"), piece("c")] });
    expect(currentPiece(r)?.id).toBe("b");
    expect(routeProgress(r)).toEqual({ done: 1, total: 3 });
  });

  test("terminar una pieza fecha el fin (y el inicio si no lo tenía); deshacerlo borra el fin", () => {
    const r = newRoute({ name: "R", pieces: [piece("a")] });
    const done = setPieceDone(r, "a", true, "2026-09-24");
    expect(done.pieces[0]).toMatchObject({ done: true, startedAt: "2026-09-24", doneAt: "2026-09-24" });
    expect(currentPiece(done)).toBeNull();
    const undone = setPieceDone(done, "a", false, "2026-09-25");
    expect(undone.pieces[0]).toMatchObject({ done: false, doneAt: null, startedAt: "2026-09-24" });
  });

  test("mover una pieza la intercambia con su vecina y se planta en los extremos", () => {
    const r = newRoute({ name: "R", pieces: [piece("a"), piece("b"), piece("c")] });
    expect(movePiece(r, "c", -1).pieces.map((p) => p.id)).toEqual(["a", "c", "b"]);
    expect(movePiece(r, "a", -1)).toBe(r);
    expect(movePiece(r, "c", 1)).toBe(r);
  });

  test("borrar una partitura desvincula las piezas que la usaban y deja intacta la ruta si ninguna lo hacía", () => {
    const r = newRoute({ name: "R", pieces: [newPiece({ id: "a", title: "A", scoreId: "s1" }), piece("b")] });
    expect(forgetScore(r, "s1").pieces[0].scoreId).toBeNull();
    expect(forgetScore(r, "otra")).toBe(r);
  });

  test("los objetivos se agrupan por plazo en el orden en que aparecen", () => {
    const r = newRoute({
      name: "R",
      goals: [
        { id: "1", horizon: "1 mes", title: "a", done: false },
        { id: "2", horizon: "3 meses", title: "b", done: false },
        { id: "3", horizon: "1 mes", title: "c", done: false },
      ],
    });
    expect(goalsByHorizon(r).map((g) => [g.horizon, g.goals.length])).toEqual([
      ["1 mes", 2],
      ["3 meses", 1],
    ]);
  });

  test("el documento que viaja no lleva los campos locales y pasa el esquema", () => {
    const doc = routeDocument({ ...newRoute({ name: "R" }), syncedAt: 5 });
    expect("syncedAt" in doc).toBe(false);
    expect(studyRouteSchema.safeParse(doc).success).toBe(true);
  });

  test("las plantillas son rutas válidas y sus piezas de catálogo existen", () => {
    for (const t of ROUTE_TEMPLATES) {
      const r = newRoute(t.draft);
      expect(studyRouteSchema.safeParse(r).success).toBe(true);
      const ids = r.pieces.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const p of r.pieces) if (p.catalogId) expect(pieceById(p.catalogId)).toBeDefined();
      expect(currentPiece(r)?.title).toBe("Minueto en re menor");
    }
  });

  test("lo que devuelve el modelo se convierte en una ruta con ids, fechas y progreso", () => {
    const imported = importedRouteSchema.parse({
      name: "Plan",
      level: "A → B",
      goal: "",
      practice: "60 min",
      pieces: [
        { title: "Uno", detail: "", why: "", estimate: "1 sem.", tag: "ENTRADA", kind: "core", done: "yes" },
        { title: "Dos", detail: "", why: "", estimate: "", tag: "actual", kind: "core", done: "no" },
      ],
      routine: [{ minutes: 10, title: "Técnica", content: "" }],
      goals: [{ horizon: "1 mes", title: "x" }],
      notes: null,
    });
    const r = routeFromImport(imported, "2026-09-24");
    expect(studyRouteSchema.safeParse(r).success).toBe(true);
    expect(r.startDate).toBe("2026-09-24");
    expect(r.pieces[0]).toMatchObject({ done: true, doneAt: "2026-09-24", tag: "entrada" });
    expect(r.pieces[1].tag).toBe("");
    expect(currentPiece(r)?.title).toBe("Dos");
    expect(r.notes).toBe("");
  });
});
