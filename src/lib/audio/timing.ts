/**
 * Latency between the audio clock and the ear, and between an input event and
 * the handler that reads it.
 *
 * Both matter for grading rhythm. A click is scheduled ahead of time on the
 * AudioContext clock, but it reaches the ear a buffer later; a tap answering
 * that click is therefore read late by the same amount. It is a systematic
 * error, not noise: over Bluetooth it is wider than the whole tolerance
 * window, so every hit lands outside it.
 */

/** Seconds between `ctx.currentTime` and the sound leaving the device. */
export function audioLatency(ctx: AudioContext): number {
  const base = Number.isFinite(ctx.baseLatency) ? ctx.baseLatency : 0.01;
  // Safari doesn't implement outputLatency; its buffer is roughly base again.
  const output = Number.isFinite(ctx.outputLatency) ? ctx.outputLatency : base;
  return base + output;
}

/**
 * The instant an input event happened, on the audio clock. Event handlers run
 * after the event — a busy frame can be tens of milliseconds late — and
 * `timeStamp` is on the same clock as `performance.now()`.
 */
export function eventAudioTime(ctx: AudioContext, timeStamp: number): number {
  const delay = (performance.now() - timeStamp) / 1000;
  // Out of range means a clock we don't recognise (some engines used epochs);
  // reading the clock now is worse but never wrong by seconds.
  if (!Number.isFinite(delay) || delay < 0 || delay > 0.5) return ctx.currentTime;
  return ctx.currentTime - delay;
}
