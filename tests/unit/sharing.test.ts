import { describe, expect, test } from "bun:test";
import { scoreCreateSchema, scorePatchSchema, sharedAtFor, toSharedMeta, DESCRIPTION_MAX } from "@/lib/server/scores-service";

const base = { id: "3f2c1b0a-1234-4abc-9def-0123456789ab", name: "Nocturno", kind: "musicxml", updatedAt: 1 };

describe("compartir partituras", () => {
  test("la visibilidad solo admite los tres valores", () => {
    expect(scorePatchSchema.safeParse({ updatedAt: 1, visibility: "public" }).success).toBe(true);
    expect(scorePatchSchema.safeParse({ updatedAt: 1, visibility: "link" }).success).toBe(true);
    expect(scorePatchSchema.safeParse({ updatedAt: 1, visibility: "friends" }).success).toBe(false);
    expect(scoreCreateSchema.safeParse({ ...base, visibility: "todos" }).success).toBe(false);
  });

  test("la presentación tiene un tope y se recorta de espacios", () => {
    const ok = scorePatchSchema.safeParse({ updatedAt: 1, description: "  hola  " });
    expect(ok.success && ok.data.description).toBe("hola");
    expect(scorePatchSchema.safeParse({ updatedAt: 1, description: "a".repeat(DESCRIPTION_MAX + 1) }).success).toBe(false);
  });

  test("sharedAt se pone al compartir por primera vez y no cambia mientras siga igual", () => {
    const now = new Date("2026-09-09T10:00:00Z");
    expect(sharedAtFor(undefined, null, now)).toBeUndefined();
    expect(sharedAtFor("private", null, now)).toBeNull();
    expect(sharedAtFor("public", null, now)).toEqual(now);
    const before = new Date("2026-09-01T00:00:00Z");
    expect(sharedAtFor("public", { visibility: "public", sharedAt: before }, now)).toEqual(before);
    // pasar de enlace a público sí cuenta como compartir de nuevo: sube en la lista
    expect(sharedAtFor("public", { visibility: "link", sharedAt: before }, now)).toEqual(now);
    // volver a privada conserva la fecha vieja, por si vuelve a compartirse
    expect(sharedAtFor("private", { visibility: "public", sharedAt: before }, now)).toEqual(before);
  });

  test("la ficha pública no lleva notas, trazos ni plan", () => {
    const row = {
      id: base.id,
      userId: "u1",
      name: "Nocturno",
      kind: "pdf",
      notes: "mis notas privadas",
      pageCount: 3,
      thumbnail: "data:image/png;base64,xx",
      annotations: { "1": [] },
      size: 100,
      uploaded: true,
      xmlSize: 10,
      createdAt: new Date("2026-09-01T00:00:00Z"),
      updatedAt: BigInt(1),
      plan: { secret: true },
      visibility: "public",
      description: "Para empezar con Chopin",
      sharedAt: new Date("2026-09-05T00:00:00Z"),
      user: { name: "Axl" },
    };
    const meta = toSharedMeta(row as never);
    expect(meta).toEqual({
      id: base.id,
      name: "Nocturno",
      kind: "pdf",
      pageCount: 3,
      thumbnail: "data:image/png;base64,xx",
      description: "Para empezar con Chopin",
      playable: true,
      hasXml: true,
      visibility: "public",
      owner: "Axl",
      sharedAt: new Date("2026-09-05T00:00:00Z").getTime(),
    });
    expect(JSON.stringify(meta)).not.toContain("privadas");
    expect(JSON.stringify(meta)).not.toContain("secret");
  });
});
