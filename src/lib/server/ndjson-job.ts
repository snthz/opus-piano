/**
 * A long server job answered as NDJSON: a `working` heartbeat every few
 * seconds while it runs, then one `done` line with the result or one `error`
 * line with a message for the student. A silent HTTP request that lasts a
 * minute or two gets cut by some proxy along the way; the heartbeat keeps it
 * alive. Shared by the study plan, the route import and anything else that
 * waits on the model.
 */

const HEARTBEAT_MS = 10_000;

export interface JobOptions<T> {
  /** The work itself; the signal fires when the browser leaves. */
  run: (signal: AbortSignal) => Promise<T>;
  /** Called after the job ends (well or badly) — receipts, cleanup. Never blocks the reply. */
  after?: () => Promise<void>;
  /** Message sent for a failure that isn't a `UserFacingError`. */
  fallback: string;
  /** Errors whose message can be shown as-is. */
  userFacing: (e: unknown) => e is Error;
  signal: AbortSignal;
}

export function ndjsonJob<T extends object>(opts: JobOptions<T>): Response {
  const started = Date.now();
  const encoder = new TextEncoder();

  // closing the tab mid-job is normal; once the client disconnects, stop
  // sending and clear the heartbeat
  let open = true;
  let beat: ReturnType<typeof setInterval> | undefined;
  const finish = () => {
    open = false;
    clearInterval(beat);
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (line: object) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
        } catch {
          finish();
        }
      };

      beat = setInterval(() => send({ type: "working", seconds: Math.round((Date.now() - started) / 1000) }), HEARTBEAT_MS);
      send({ type: "working", seconds: 0 });

      opts
        .run(opts.signal)
        .then((result) => send({ type: "done", ...result }))
        .catch((e: unknown) => {
          if (opts.signal.aborted) return;
          if (opts.userFacing(e)) send({ type: "error", message: e.message });
          else {
            console.error("ndjson-job: unexpected failure", e);
            send({ type: "error", message: opts.fallback });
          }
        })
        .finally(async () => {
          await opts.after?.();
          const wasOpen = open;
          finish();
          if (!wasOpen) return;
          try {
            controller.close();
          } catch {
            // already closed by the runtime when the browser left
          }
        });
    },
    // called by the runtime when the browser disconnects
    cancel: finish,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // stop any proxy from buffering lines and eating heartbeats
      "X-Accel-Buffering": "no",
      "Content-Encoding": "identity",
    },
  });
}
