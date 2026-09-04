"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { recordAnswer } from "@/lib/progress";
import { ChevronIcon } from "@/components/ui/arrow-icon";

export interface SessionStats {
  total: number;
  correct: number;
  streak: number;
  bestStreak: number;
}

/** Estadísticas de la sesión actual; cada respuesta se guarda también en el progreso global. */
export function useExerciseSession(exerciseId: string) {
  const [stats, setStats] = useState<SessionStats>({ total: 0, correct: 0, streak: 0, bestStreak: 0 });
  const answer = useCallback(
    (correct: boolean) => {
      setStats((s) => {
        const streak = correct ? s.streak + 1 : 0;
        recordAnswer(exerciseId, correct, streak);
        return {
          total: s.total + 1,
          correct: s.correct + (correct ? 1 : 0),
          streak,
          bestStreak: Math.max(s.bestStreak, streak),
        };
      });
    },
    [exerciseId],
  );
  const reset = useCallback(() => setStats({ total: 0, correct: 0, streak: 0, bestStreak: 0 }), []);
  return { stats, answer, reset };
}

export interface Feedback {
  correct: boolean;
  message: React.ReactNode;
}

export function ExerciseShell({
  title,
  stats,
  settings,
  children,
  feedback,
  onNext,
  color = "bg-mint",
}: {
  title: string;
  stats: SessionStats;
  /** Controles de configuración (clave, rango…) */
  settings?: React.ReactNode;
  children: React.ReactNode;
  feedback: Feedback | null;
  onNext: () => void;
  color?: string;
}) {
  const [showSettings, setShowSettings] = useState(false);
  const accuracy = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/practica" aria-label="Volver a Práctica" className="card w-11 h-11 flex items-center justify-center hover:bg-surface-2">
          <ChevronIcon dir="left" />
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {settings ? (
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            aria-expanded={showSettings}
            aria-label="Opciones del ejercicio"
            className={`w-11 h-11 rounded-full flex items-center justify-center ${showSettings ? "bg-ink text-bg" : "card hover:bg-surface-2"}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="w-5 h-5" aria-hidden="true">
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8" strokeLinecap="round" />
              <circle cx="15" cy="7" r="2.5" />
              <circle cx="9" cy="17" r="2.5" />
            </svg>
          </button>
        ) : (
          <span className="w-11" />
        )}
      </div>

      {showSettings && settings && <div className="card p-4 space-y-3 text-sm">{settings}</div>}

      <div className={`card-pastel ${color} px-4 py-3 grid grid-cols-3 text-center`}>
        <div>
          <p className="text-2xl font-bold tabular-nums">
            {stats.correct}
            <span className="text-ink-2 text-base font-medium">/{stats.total}</span>
          </p>
          <p className="text-xs text-ink-2">aciertos</p>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{accuracy}%</p>
          <p className="text-xs text-ink-2">precisión</p>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{stats.streak}</p>
          <p className="text-xs text-ink-2">racha {stats.bestStreak > 0 && `· mejor ${stats.bestStreak}`}</p>
        </div>
      </div>

      <div className="card p-4 md:p-6 space-y-5">{children}</div>

      {feedback && (
        <div
          role="status"
          className={`card-pastel px-5 py-4 flex items-center justify-between gap-3 ${feedback.correct ? "bg-ok-soft" : "bg-bad-soft"}`}
        >
          <div className="text-sm">
            <strong className="block">{feedback.correct ? "¡Correcto!" : "No exactamente"}</strong>
            <span className="text-ink-2">{feedback.message}</span>
          </div>
          <button type="button" onClick={onNext} autoFocus className="btn-circle shrink-0" aria-label="Siguiente">
            <ChevronIcon />
          </button>
        </div>
      )}
    </div>
  );
}

/** Botón de opción de respuesta. */
export function OptionButton({
  children,
  onClick,
  state = "idle",
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  state?: "idle" | "correct" | "wrong" | "dim";
  disabled?: boolean;
  className?: string;
}) {
  const styles = {
    idle: "bg-surface-2 hover:bg-surface-3 text-ink",
    correct: "bg-ok text-white",
    wrong: "bg-bad text-white",
    dim: "bg-surface-2 text-ink-3",
  }[state];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl px-3 py-3 font-medium transition-colors disabled:cursor-default ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <span className="text-ink-2">{label}</span>
      <div className="flex gap-1.5 flex-wrap">{children}</div>
    </div>
  );
}

export function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`pill py-1.5 px-3 text-xs ${active ? "pill-active" : ""}`}>
      {children}
    </button>
  );
}
