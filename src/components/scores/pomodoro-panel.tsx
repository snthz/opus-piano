"use client";

import { useState } from "react";
import { PlayIcon } from "@/components/calendar/session-card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { unlockAudio } from "@/lib/audio/synth";
import { CONFIG_LIMITS, PHASE_LABELS, usePomodoro, type PomodoroConfig } from "@/lib/pomodoro";
import { clock } from "@/lib/session-run";

const TomatoIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className} aria-hidden>
    <path d="M12 7.5c-4.4 0-7.5 2.6-7.5 6.4C4.5 17.8 7.9 20.5 12 20.5s7.5-2.7 7.5-6.6c0-3.8-3.1-6.4-7.5-6.4z" strokeLinejoin="round" />
    <path d="M12 7.5V4.5M12 7.5c1.2-1.4 2.8-2 4.5-1.8M12 7.5C10.8 6.1 9.2 5.5 7.5 5.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PauseIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <rect x="6" y="5.5" width="4" height="13" rx="1.2" />
    <rect x="14" y="5.5" width="4" height="13" rx="1.2" />
  </svg>
);

const FIELDS: { key: keyof PomodoroConfig; label: string; unit: string }[] = [
  { key: "focus", label: "Estudio", unit: "min" },
  { key: "short", label: "Descanso", unit: "min" },
  { key: "long", label: "Largo", unit: "min" },
  { key: "rounds", label: "Rondas", unit: "" },
];

/**
 * The pomodoro beside the score: the phase and its clock, the round dots,
 * play/pause, skip and reset, and the times folded away underneath. The
 * clock itself lives in `usePomodoro`, shared with the toolbar chip.
 */
export function PomodoroPanel() {
  const p = usePomodoro();
  const [editing, setEditing] = useState(false);
  const { state, config } = p;
  const onBreak = state.phase !== "focus";
  const untouched = !p.active;

  const toggle = async () => {
    if (p.running) p.pause();
    else {
      // from a user gesture: iOS won't play the chime later otherwise
      await unlockAudio();
      p.start();
    }
  };

  return (
    <section className={`card-pastel p-4 space-y-4 transition-colors ${onBreak ? "bg-mint" : "bg-peach"}`} aria-label="Pomodoro">
      <header className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-full bg-ink text-bg grid place-items-center shrink-0">
          <TomatoIcon />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-tight">Pomodoro</h3>
          <p className="text-xs text-ink-2">
            {config.focus} min de estudio, {config.short} de descanso · largo de {config.long} cada {config.rounds}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
          className={`pill text-xs py-1 px-2.5 ${editing ? "pill-active" : ""}`}
        >
          Tiempos
        </button>
      </header>

      {editing && (
        <div className="grid grid-cols-2 gap-2">
          {FIELDS.map((f) => {
            const lim = CONFIG_LIMITS[f.key];
            const v = config[f.key];
            return (
              <div key={f.key} className="rounded-2xl bg-surface px-3 py-2 flex items-center gap-1.5">
                <span className="text-xs text-ink-2 flex-1 min-w-0 truncate">{f.label}</span>
                <Step label={`Menos ${f.label.toLowerCase()}`} disabled={v <= lim.min} onClick={() => p.setConfig({ [f.key]: v - lim.step })}>
                  −
                </Step>
                <span className="tabular-nums text-sm font-semibold w-9 text-center">
                  {v}
                  {f.unit && <span className="text-[10px] text-ink-3 font-normal"> {f.unit}</span>}
                </span>
                <Step label={`Más ${f.label.toLowerCase()}`} disabled={v >= lim.max} onClick={() => p.setConfig({ [f.key]: v + lim.step })}>
                  +
                </Step>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="relative grid place-items-center text-ink w-28 h-28 shrink-0">
          <ProgressRing progress={p.fraction} stroke={2.5} className="w-28 h-28" />
          <div className="absolute text-center">
            <p className="text-3xl font-bold tabular-nums tracking-tight leading-none" aria-live="off">
              {clock(p.remaining)}
            </p>
            <p className="mt-1 text-[11px] text-ink-2">{PHASE_LABELS[state.phase]}</p>
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          {/* one dot per study block of the cycle: filled once done, ringed while on */}
          <div className="flex items-center gap-1.5" aria-label={`Ronda ${state.round} de ${config.rounds}`}>
            {Array.from({ length: config.rounds }, (_, i) => {
              const n = i + 1;
              const finished = n < state.round || (n === state.round && onBreak);
              const current = n === state.round && !onBreak;
              return (
                <span
                  key={n}
                  className={`w-2.5 h-2.5 rounded-full ${finished ? "bg-ink" : current ? "border-2 border-ink" : "bg-ink/20"}`}
                  aria-hidden
                />
              );
            })}
            <span className="ml-1 text-xs text-ink-2 tabular-nums">
              {state.done > 0 ? `${state.done} ${state.done === 1 ? "bloque" : "bloques"}` : `ronda ${state.round}`}
            </span>
          </div>

          <p className="text-sm text-ink-2 leading-snug">
            {onBreak
              ? "Levántate del piano: suelta manos y hombros. Al acabar sonará un aviso."
              : p.running
                ? "Concéntrate en el objetivo de hoy; el descanso llega solo."
                : untouched
                  ? "Bloques cortos con descansos: la mano aprende más y se cansa menos."
                  : "En pausa. Pulsa ▶ para seguir."}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void toggle()}
              aria-pressed={p.running}
              aria-label={p.running ? "Pausar el pomodoro" : "Poner en marcha el pomodoro"}
              className="btn-circle w-12 h-12 shadow-md active:scale-95"
            >
              {p.running ? <PauseIcon /> : <PlayIcon className="w-6 h-6 translate-x-0.5" />}
            </button>
            <button type="button" onClick={p.skip} className="pill text-xs py-1.5" title={onBreak ? "Terminar el descanso ahora" : "Pasar al descanso ahora"}>
              {onBreak ? "Volver a estudiar" : "Descansar ya"}
            </button>
            {!untouched && (
              <button type="button" onClick={p.reset} className="text-xs text-ink-2 hover:text-ink underline ml-auto">
                Reiniciar
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Step({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="w-7 h-7 rounded-full bg-surface-2 border border-line text-ink font-semibold hover:bg-surface-3 disabled:opacity-35"
    >
      {children}
    </button>
  );
}

/**
 * Floating clock over the score while a pomodoro is on: its ring ticks down
 * live with the time left, phase-coloured, so it reads at a glance without
 * opening anything. Tapping it opens the study panel where the controls are.
 */
export function PomodoroFloatingButton({ onOpen }: { onOpen: () => void }) {
  const p = usePomodoro();
  if (!p.active) return null;
  const onBreak = p.state.phase !== "focus";
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${PHASE_LABELS[p.state.phase]} · ${p.running ? "en marcha" : "en pausa"}`}
      aria-label={`Pomodoro: ${PHASE_LABELS[p.state.phase]}, quedan ${clock(p.remaining)}`}
      className={`relative grid place-items-center w-14 h-14 rounded-full shadow-lg shrink-0 transition-colors ${
        onBreak ? "bg-mint text-ok" : "bg-peach text-ink"
      } ${!p.running ? "opacity-70" : ""}`}
    >
      <ProgressRing progress={p.fraction} stroke={2.5} className="absolute inset-0 w-14 h-14" />
      <span className="relative text-[13px] font-bold tabular-nums leading-none">{clock(p.remaining)}</span>
    </button>
  );
}
