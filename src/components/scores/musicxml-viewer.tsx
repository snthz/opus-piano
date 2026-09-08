"use client";

import { useState } from "react";
import { keyByVex, keyName } from "@/lib/music/keys";
import { useSettings } from "@/lib/settings";
import { ScoreSheet } from "./score-sheet";
import { useParsedXml, useScorePlayer } from "./use-score-player";

interface Props {
  file: Blob;
}

/** Partitura MusicXML: información, controles de escucha y nombres, y los sistemas. */
export function MusicXmlViewer({ file }: Props) {
  const { settings } = useSettings();
  const { parsed, error } = useParsedXml(file);
  const player = useScorePlayer(parsed);
  const [showNames, setShowNames] = useState(false);

  if (error) return <p className="text-sm text-bad">{error}</p>;
  if (!parsed) return <p className="text-sm text-ink-2">Leyendo la partitura…</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-2">
        {parsed.measures.length} compases · {keyName(keyByVex(parsed.keyVex), settings.naming)} · {parsed.time.num}/{parsed.time.den}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void player.toggle()}
          disabled={!settings.sound}
          className={`pill py-1.5 text-sm ${player.playing ? "bg-bad text-bg" : "bg-accent text-bg"} disabled:opacity-50`}
        >
          {player.playing ? "■ Detener" : "▶ Escuchar"}
        </button>
        <button type="button" onClick={() => setShowNames((v) => !v)} className={`pill py-1.5 text-xs ${showNames ? "pill-active" : ""}`}>
          {showNames ? "Ocultar nombres" : "Mostrar nombres"}
        </button>
        <label className="flex items-center gap-2 text-xs text-ink-2 ml-auto">
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

      <ScoreSheet parsed={parsed} active={player.active} showNames={showNames} />
    </div>
  );
}
