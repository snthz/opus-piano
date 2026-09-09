import { describe, expect, test } from "bun:test";
import { arpeggioFingering, parseBpm, parseKeyName, scaleFingering } from "@/lib/music/fingering";
import { ALL_KEYS, keyByVex } from "@/lib/music/keys";

describe("digitaciones de escalas", () => {
  test("todas las tonalidades tienen digitación, de ocho dedos por mano", () => {
    for (const k of ALL_KEYS) {
      const f = scaleFingering(k);
      expect(f, k.vex).not.toBeNull();
      expect(f!.rh).toHaveLength(8);
      expect(f!.lh).toHaveLength(8);
      expect(f!.rh.every((d) => d >= 1 && d <= 5)).toBe(true);
      expect(f!.lh.every((d) => d >= 1 && d <= 5)).toBe(true);
    }
  });

  test("las de siempre: do mayor y fa mayor", () => {
    expect(scaleFingering(keyByVex("C"))).toEqual({ rh: [1, 2, 3, 1, 2, 3, 4, 5], lh: [5, 4, 3, 2, 1, 3, 2, 1] });
    expect(scaleFingering(keyByVex("F"))!.rh).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
    expect(scaleFingering(keyByVex("Bm"))!.lh).toEqual([4, 3, 2, 1, 4, 3, 2, 1]);
  });

  test("el arpegio solo se digita con la tónica en tecla blanca", () => {
    expect(arpeggioFingering(keyByVex("G"))).toEqual({ rh: [1, 2, 3, 5], lh: [5, 3, 2, 1] });
    expect(arpeggioFingering(keyByVex("Eb"))).toBeNull();
  });
});

describe("leer la tonalidad del texto del plan", () => {
  test("en latino y en anglosajón, con y sin alteración", () => {
    expect(parseKeyName("Sol mayor")?.vex).toBe("G");
    expect(parseKeyName("la menor")?.vex).toBe("Am");
    expect(parseKeyName("Si♭ mayor")?.vex).toBe("Bb");
    expect(parseKeyName("Fa sostenido menor")?.vex).toBe("F#m");
    expect(parseKeyName("G major")?.vex).toBe("G");
    expect(parseKeyName("F# minor")?.vex).toBe("F#m");
    expect(parseKeyName("Bb")?.vex).toBe("Bb");
    expect(parseKeyName("Am")?.vex).toBe("Am");
    expect(parseKeyName("Mi menor (relativo de Sol mayor)")?.vex).toBe("Em");
  });

  test("una grafía que no es tonalidad cae en su enarmónica", () => {
    expect(parseKeyName("Re♯ mayor")?.vex).toBe("Eb");
    expect(parseKeyName("Sol♭ menor")?.vex).toBe("F#m");
  });

  test("sin tonalidad al principio, null", () => {
    expect(parseKeyName("no consta")).toBeNull();
    expect(parseKeyName("")).toBeNull();
  });
});

describe("leer el tempo", () => {
  test("prefiere la cifra tras el igual y respeta el rango del metrónomo", () => {
    expect(parseBpm("♩ = 72 sin errores 3 veces seguidas")).toBe(72);
    expect(parseBpm("♩ = 120 (Allegro); empezar a ♩ = 60")).toBe(120);
    expect(parseBpm("compases 1-16 a 80")).toBe(80);
    expect(parseBpm("sin fallos")).toBeNull();
    expect(parseBpm("♩ = 400")).toBeNull();
  });
});
