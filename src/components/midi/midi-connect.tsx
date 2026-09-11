"use client";

import { unlockAudio } from "@/lib/audio/synth";
import { connectMidi, disconnectMidi, useMidi } from "@/lib/midi";

/** Un teclado dibujado, para decir de qué va el botón sin escribir «MIDI» tres veces. */
function KeyboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M7 6v7M12 6v7M17 6v7" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Conectar el teclado MIDI, donde haga falta.
 *
 * Si el navegador no admite Web MIDI no se enseña nada: no hay nada que
 * ofrecer y el ejercicio funciona igual con el teclado de la pantalla.
 */
export function MidiConnect({ className = "" }: { className?: string }) {
  const midi = useMidi(true);
  if (!midi.supported) return null;

  const connected = midi.status === "on";
  const name = midi.devices.length
    ? (midi.deviceId ? midi.devices.find((d) => d.id === midi.deviceId)?.name : midi.devices[0].name) ?? "Teclado MIDI"
    : null;

  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => {
          if (connected) return disconnectMidi();
          // Este clic es el gesto que desbloquea el audio en iOS y compañía:
          // lo que venga del teclado ya no lo es, y sonaría en silencio.
          void unlockAudio();
          void connectMidi();
        }}
        disabled={midi.status === "asking"}
        className={`pill py-1.5 text-xs ${connected ? "pill-active" : ""} disabled:opacity-50`}
      >
        <KeyboardIcon />
        {midi.status === "asking" ? "Conectando…" : connected ? (name ?? "Sin teclados") : "Conectar teclado MIDI"}
      </button>
      {connected && !midi.devices.length && (
        <span className="text-xs text-ink-3">Conecta un teclado por USB o Bluetooth.</span>
      )}
      {midi.error && <span className="text-xs text-bad">{midi.error}</span>}
    </div>
  );
}
