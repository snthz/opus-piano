"use client";

import { SettingRow, Choice } from "./exercise-shell";
import { useSettings } from "@/lib/settings";

/**
 * Con qué nombres se responde. Está dentro del ejercicio, y no solo en
 * Ajustes, porque es la decisión que más cambia la pantalla: quien está
 * pasando de «do re mi» al cifrado americano quiere los dos a la vez durante
 * un tiempo, y después solo el segundo. Escribe en los ajustes de siempre, así
 * que el resto de la app va a juego.
 */
export function NamingRow({ label = "Nombres" }: { label?: string }) {
  const { settings, update } = useSettings();
  const mode = `${settings.naming}${settings.dualNames ? "+" : ""}`;
  const options: [string, string, "latino" | "anglosajon", boolean][] = [
    ["latino", "do re mi", "latino", false],
    ["latino+", "do (C)", "latino", true],
    ["anglosajon+", "C (do)", "anglosajon", true],
    ["anglosajon", "C D E", "anglosajon", false],
  ];
  return (
    <SettingRow label={label}>
      {options.map(([id, text, naming, dualNames]) => (
        <Choice key={id} active={mode === id} onClick={() => update({ naming, dualNames })}>
          {text}
        </Choice>
      ))}
    </SettingRow>
  );
}
