import { describe, expect, test } from "bun:test";
import { detectPitch, OnsetDetector, rms, spectralFlux } from "@/lib/audio/pitch-detect";
import { frequencyToMidi, midiToFrequency } from "@/lib/music/pitch";

const RATE = 44100;

/** `length` samples of a wave with the given harmonics, in amplitude order. */
function wave(freq: number, length = 2048, harmonics = [1], noise = 0): Float32Array {
  const buffer = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let value = 0;
    harmonics.forEach((amplitude, h) => {
      value += amplitude * Math.sin((2 * Math.PI * freq * (h + 1) * i) / RATE);
    });
    if (noise) value += (Math.random() * 2 - 1) * noise;
    buffer[i] = value * 0.5;
  }
  return buffer;
}

describe("rms", () => {
  test("el silencio no suena y una senoide suena la mitad de su cresta", () => {
    expect(rms(new Float32Array(512))).toBe(0);
    expect(rms(wave(440))).toBeCloseTo(0.5 / Math.SQRT2, 2);
  });
});

describe("detectPitch", () => {
  test("una senoide da su frecuencia", () => {
    for (const freq of [98, 220, 440, 659.25]) {
      const got = detectPitch(wave(freq), RATE);
      expect(got).not.toBeNull();
      expect(Math.abs(got! - freq) / freq).toBeLessThan(0.01);
    }
  });

  test("con armónicos da la fundamental, no la octava", () => {
    // Una voz o un piano tienen más armónicos que fundamental; el error
    // clásico es dar la octava de arriba.
    const got = detectPitch(wave(196, 2048, [1, 0.8, 0.6, 0.4, 0.2]), RATE);
    expect(got).not.toBeNull();
    expect(Math.abs(got! - 196) / 196).toBeLessThan(0.02);
  });

  test("afina lo bastante para saber si cantas desafinado", () => {
    // Medio semitono (50 cents) es el margen entre una nota y la siguiente.
    const freq = midiToFrequency(62);
    const got = detectPitch(wave(freq, 2048, [1, 0.5, 0.3]), RATE)!;
    const cents = Math.abs(frequencyToMidi(got) - 62) * 100;
    expect(cents).toBeLessThan(20);
  });

  test("el silencio y el ruido no son ninguna nota", () => {
    expect(detectPitch(new Float32Array(2048), RATE)).toBeNull();
    const noise = new Float32Array(2048).map(() => (Math.random() * 2 - 1) * 0.3);
    expect(detectPitch(noise, RATE)).toBeNull();
  });

  test("una nota muy floja se toma por silencio", () => {
    expect(detectPitch(wave(440).map((v) => v * 0.005), RATE)).toBeNull();
  });

  test("fuera del rango pedido no se busca", () => {
    expect(detectPitch(wave(440), RATE, { minFreq: 600, maxFreq: 1200 })).toBeNull();
  });
});

describe("spectralFlux", () => {
  const flat = new Float32Array([-60, -60, -60, -60]);

  test("sin cambios no hay flujo", () => {
    expect(spectralFlux(flat, flat)).toBe(0);
  });

  test("solo cuenta lo que crece: una nota que se apaga no empieza nada", () => {
    expect(spectralFlux(flat, new Float32Array([-40, -40, -60, -60]))).toBeCloseTo(10);
    expect(spectralFlux(flat, new Float32Array([-90, -90, -90, -90]))).toBe(0);
  });
});

describe("OnsetDetector", () => {
  test("dispara con el golpe y no con el fondo", () => {
    const onsets = new OnsetDetector();
    let time = 0;
    const step = () => (time += 0.016);
    // Fondo tranquilo: nada.
    for (let i = 0; i < 10; i++) expect(onsets.push(0.2, step())).toBe(false);
    // Golpe.
    expect(onsets.push(8, step())).toBe(true);
  });

  test("un golpe que dura varios fotogramas se cuenta una vez", () => {
    const onsets = new OnsetDetector();
    let time = 0;
    const step = () => (time += 0.016);
    for (let i = 0; i < 10; i++) onsets.push(0.2, step());
    expect(onsets.push(8, step())).toBe(true);
    let extra = 0;
    for (let i = 0; i < 4; i++) if (onsets.push(7, step())) extra++;
    expect(extra).toBe(0);
  });

  test("abrir el micrófono no cuenta como golpe", () => {
    const onsets = new OnsetDetector();
    expect(onsets.push(20, 0)).toBe(false);
  });

  test("tras reiniciar vuelve a necesitar historia", () => {
    const onsets = new OnsetDetector();
    let time = 0;
    for (let i = 0; i < 10; i++) onsets.push(0.2, (time += 0.016));
    expect(onsets.push(8, (time += 0.016))).toBe(true);
    onsets.reset();
    expect(onsets.push(8, (time += 0.016))).toBe(false);
  });
});
