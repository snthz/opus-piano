"use client";

import { getAudioContext } from "./synth";
import { detectPitch, OnsetDetector, rms, spectralFlux } from "./pitch-detect";
import { UserError } from "@/lib/user-error";

/**
 * The microphone as an input: hits and sung notes.
 *
 * Not everyone has a MIDI keyboard, but everyone has a microphone. It's what
 * lets the rhythm exercise be clapped instead of tapped on glass, and the
 * solfège exercise check what was sung instead of taking the student's word
 * for it.
 *
 * It listens on the app's own AudioContext, the same one the metronome uses,
 * so an onset and a click can be compared on one clock: with two clocks the
 * error would be as big as what's being measured.
 *
 * Nothing is recorded or sent anywhere — the samples are read, measured and
 * dropped frame by frame.
 */

export interface ListenOptions {
  /** A note starts. `time` is on the AudioContext clock. */
  onOnset?: (time: number, level: number) => void;
  /** The note being held: frequency in Hz, or null in silence. */
  onPitch?: (freq: number | null, level: number, time: number) => void;
  /** Milliseconds between pitch analyses; it's the expensive part. */
  pitchEvery?: number;
}

export interface Listener {
  stop: () => void;
}

const FFT_SIZE = 2048;
/** Floor for the spectrum in dB: silence comes as -Infinity and would break the arithmetic. */
const DB_FLOOR = -140;

export function micSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

/**
 * Opens the microphone and analyses it until `stop()`. Must be called from a
 * user gesture the first time: that's when the browser asks for permission.
 */
export async function startListening(options: ListenOptions): Promise<Listener> {
  if (!micSupported()) throw new UserError("Este navegador no da acceso al micrófono.");

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      // The browser's cleanup is made for speech: it would smooth out exactly
      // the attacks being measured, and bend the pitch of a held note.
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch {
    throw new UserError("No se pudo usar el micrófono. Revisa el permiso del navegador.");
  }

  const ctx = getAudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  // No smoothing: the flux measures the jump between frames, and smoothing is
  // precisely what flattens it. Nothing is connected to the output either —
  // the microphone through the speakers is a howl.
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser);

  const samples = new Float32Array(analyser.fftSize);
  const spectrum = new Float32Array(analyser.frequencyBinCount);
  let previousSpectrum: Float32Array | null = null;
  const onsets = new OnsetDetector();
  const pitchEvery = options.pitchEvery ?? 25;
  let lastPitchAt = 0;
  let frame = 0;
  let stopped = false;

  // The analyser always hands back the last window of sound, so what is being
  // looked at already happened: half a window ago, roughly. Without taking it
  // off, every hit would read late by that much.
  const lag = analyser.fftSize / 2 / ctx.sampleRate;

  const tick = () => {
    if (stopped) return;
    frame = requestAnimationFrame(tick);
    const now = ctx.currentTime;

    analyser.getFloatFrequencyData(spectrum);
    for (let i = 0; i < spectrum.length; i++) if (!Number.isFinite(spectrum[i])) spectrum[i] = DB_FLOOR;

    if (options.onOnset && previousSpectrum) {
      const flux = spectralFlux(previousSpectrum, spectrum);
      if (onsets.push(flux, now)) {
        analyser.getFloatTimeDomainData(samples);
        options.onOnset(now - lag, rms(samples));
      }
    }
    if (options.onOnset) previousSpectrum = Float32Array.from(spectrum);

    if (options.onPitch && now - lastPitchAt >= pitchEvery / 1000) {
      lastPitchAt = now;
      analyser.getFloatTimeDomainData(samples);
      options.onPitch(detectPitch(samples, ctx.sampleRate), rms(samples), now - lag);
    }
  };
  frame = requestAnimationFrame(tick);

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(frame);
      source.disconnect();
      for (const track of stream.getTracks()) track.stop();
    },
  };
}
