"use client";

import { useState, type ReactNode } from "react";
import { keyByVex, keyName } from "@/lib/music/keys";
import { useSettings } from "@/lib/settings";
import { EngravedScore } from "./engraved-score";
import { ScoreSheet } from "./score-sheet";
import { useParsedXml, useScorePlayer } from "./use-score-player";

interface Props {
  file: Blob;
}

/**
 * Una partitura MusicXML de la biblioteca.
 *
 * Se ve como está escrita —la partitura original, grabada, igual que un PDF
 * enseña sus páginas—, y suena siguiéndose nota a nota sobre ella. El dibujo
 * propio de la app es el otro modo: aplana las voces y se deja los adornos,
 * pero es el único que puede escribir el nombre de cada nota debajo, que es
 * para lo que está.
 */
export function MusicXmlViewer({ file }: Props) {
  const { settings } = useSettings();
  const { parsed, xml, error } = useParsedXml(file);
  const player = useScorePlayer(parsed);
  const [names, setNames] = useState(false);

  if (error) return <p className="text-sm text-bad">{error}</p>;
  if (!parsed) return <p className="text-sm text-ink-2">Leyendo la partitura…</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-2">
        {parsed.measures.length} compases · {keyName(keyByVex(parsed.keyVex), settings.naming)} · {parsed.time.num}/{parsed.time.den}
      </p>

      <PlaybackControls player={player}>
        <button type="button" onClick={() => setNames((v) => !v)} className={`pill py-1.5 text-xs ${names ? "pill-active" : ""}`}>
          {names ? "Ver la original" : "Nombres de las notas"}
        </button>
      </PlaybackControls>

      {names || !xml ? (
        <ScoreSheet parsed={parsed} active={player.active} showNames={names} />
      ) : (
        <EngravedScore
          xml={xml}
          position={player.position}
          playing={player.playing}
          // un MusicXML que Verovio no entienda se sigue leyendo con el dibujo de la app
          fallback={<ScoreSheet parsed={parsed} active={player.active} showNames={false} />}
        />
      )}
    </div>
  );
}

/**
 * Escuchar y a qué velocidad: los dos mandos que valen igual para el dibujo
 * de la app y para la partitura grabada. Lo que cada vista añada de suyo
 * (los nombres de las notas, por ejemplo) va como hijo.
 */
export function PlaybackControls({
  player,
  children,
}: {
  player: ReturnType<typeof useScorePlayer>;
  children?: ReactNode;
}) {
  const { settings } = useSettings();
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void player.toggle()}
          disabled={!settings.sound}
          className={`pill py-1.5 text-sm ${player.playing ? "bg-bad text-bg" : "bg-accent text-bg"} disabled:opacity-50`}
        >
          {player.playing ? "■ Detener" : "▶ Escuchar"}
        </button>
        {children}
        <label className="ml-auto flex items-center gap-2 text-xs text-ink-2">
          ♩ = {player.tempo}
          <input
            type="range"
            min={40}
            max={200}
            value={player.tempo}
            onChange={(e) => player.setTempo(Number(e.target.value))}
            disabled={player.playing}
            className="accent-(--accent) w-28"
            aria-label="Tempo"
          />
        </label>
      </div>
      {!settings.sound && <p className="text-xs text-bad">Activa el sonido en Ajustes para escuchar la partitura.</p>}
    </>
  );
}
