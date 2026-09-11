"use client";

import { NumberField } from "@/components/ui/number-field";
import type { useScorePlayer } from "./use-score-player";

/**
 * Los mandos de ensayar, que no son los de escuchar.
 *
 * Nadie estudia una pieza tocándola entera de principio a fin: se coge un
 * trozo corto, se repite hasta que sale, se toca una mano mientras suena la
 * otra y se va subiendo la velocidad. Eso es todo lo que hay aquí.
 */
export function RehearsePanel({
  player,
  measures,
  staves,
  beatsPerBar,
}: {
  player: ReturnType<typeof useScorePlayer>;
  /** Cuántos compases tiene la pieza. */
  measures: number;
  /** Nombre de cada pentagrama, de arriba abajo. */
  staves: string[];
  beatsPerBar: number;
}) {
  const { practice, setPractice } = player;
  const range = practice.range ?? { from: 1, to: measures };
  const looping = !!practice.range || practice.loop;

  const setRange = (from: number, to: number) =>
    setPractice({ range: { from: Math.min(from, to), to: Math.max(from, to) } });

  return (
    <div className="card space-y-3 p-4 text-sm">
      <Row label="Compases">
        {practice.range ? (
          <div className="flex items-center gap-2">
            <NumberField
              value={range.from}
              onChange={(v) => setRange(v, range.to)}
              min={1}
              max={measures}
              aria-label="Primer compás"
              className="w-24"
            />
            <span className="text-ink-3">a</span>
            <NumberField
              value={range.to}
              onChange={(v) => setRange(range.from, v)}
              min={1}
              max={measures}
              aria-label="Último compás"
              className="w-24"
            />
            <button type="button" onClick={() => setPractice({ range: null })} className="pill py-1.5 text-xs">
              Toda
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPractice({ range: { from: 1, to: Math.min(4, measures) }, loop: true })}
            className="pill py-1.5 text-xs"
          >
            Elegir un trozo
          </button>
        )}
      </Row>

      {staves.length > 1 && (
        <Row label="Qué suena">
          <div className="flex flex-wrap gap-1.5">
            <Pill active={!practice.silentStaves.length} onClick={() => setPractice({ silentStaves: [] })}>
              Las dos
            </Pill>
            {staves.map((name, staff) => (
              <Pill
                key={name}
                active={practice.silentStaves.length === staves.length - 1 && !practice.silentStaves.includes(staff)}
                onClick={() => setPractice({ silentStaves: staves.map((_, i) => i).filter((i) => i !== staff) })}
              >
                Solo {name}
              </Pill>
            ))}
          </div>
        </Row>
      )}

      <Row label="En bucle" hint="Vuelve a empezar al llegar al final.">
        <Toggle checked={practice.loop} onChange={(v) => setPractice({ loop: v })} label="Repetir en bucle" />
      </Row>

      <Row label="Cuenta atrás" hint={`Un compás de ${beatsPerBar} antes de la primera nota.`}>
        <Toggle
          checked={practice.countIn > 0}
          onChange={(v) => setPractice({ countIn: v ? beatsPerBar : 0 })}
          label="Cuenta atrás"
        />
      </Row>

      <Row
        label="Subir el tempo"
        hint={
          practice.tempoStep
            ? `+${practice.tempoStep} en cada vuelta, hasta ♩ = ${practice.tempoMax}.`
            : "Cada vuelta, un poco más rápido."
        }
      >
        <div className="flex items-center gap-1.5">
          {[0, 2, 5].map((step) => (
            <Pill key={step} active={practice.tempoStep === step} onClick={() => setPractice({ tempoStep: step, loop: step ? true : practice.loop })}>
              {step === 0 ? "No" : `+${step}`}
            </Pill>
          ))}
          {practice.tempoStep > 0 && (
            <NumberField
              value={practice.tempoMax}
              onChange={(v) => setPractice({ tempoMax: v })}
              min={40}
              max={240}
              step={5}
              aria-label="Tempo máximo"
              className="w-24"
            />
          )}
        </div>
      </Row>

      {looping && player.playing && (
        <p className="text-xs text-ink-3">
          Vuelta {player.pass + 1}
          {practice.tempoStep > 0 && ` · ♩ = ${player.currentTempo}`}
        </p>
      )}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`pill px-3 py-1.5 text-xs ${active ? "pill-active" : ""}`}>
      {children}
    </button>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`h-7 w-12 shrink-0 rounded-full p-0.5 transition-colors ${checked ? "bg-ink" : "bg-surface-3"}`}
    >
      <span className={`block h-6 w-6 rounded-full bg-surface shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}
