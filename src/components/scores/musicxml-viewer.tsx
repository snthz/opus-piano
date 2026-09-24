"use client";

import { useState, type ReactNode } from "react";
import { playNote } from "@/lib/audio/synth";
import { useMidiNotes } from "@/lib/midi";
import { keyByVex, keyName } from "@/lib/music/keys";
import type { Stroke } from "@/lib/scores-db";
import { useSettings } from "@/lib/settings";
import { AnnotationOptions, AnnotationTools, Group, ToolButton } from "./annotation-tools";
import { EngravedScore } from "./engraved-score";
import { NoteNamesIcon, PlayIcon, RehearseIcon, StopIcon } from "./reader-icons";
import { RehearsePanel } from "./rehearse-panel";
import {
  ScoreAnnotator,
  DEFAULT_FINGER_SIZE,
  DEFAULT_HIGHLIGHT_COLOR,
  DEFAULT_LINER_WIDTH,
  DEFAULT_PEN_WIDTH,
  PEN_COLORS,
  type Finger,
  type Tool,
} from "./score-annotator";
import { ScoreSheet } from "./score-sheet";
import { useParsedXml, useScorePlayer } from "./use-score-player";

interface Props {
  file: Blob;
  /**
   * Para escribir encima: los trazos de cada página y dónde guardarlos. Sin
   * esto la partitura se ve y suena, pero no se anota (una pieza del catálogo
   * o una compartida, que no son tuyas hasta que las guardas).
   */
  annotations?: {
    strokesOf: (page: number) => Stroke[];
    onStrokes: (page: number, strokes: Stroke[]) => void;
  };
}

/**
 * Una partitura MusicXML, leída como se lee una partitura.
 *
 * Se ve como está escrita —la original, grabada, igual que un PDF enseña sus
 * páginas—, suena siguiéndose nota a nota sobre ella y se puede escribir
 * encima con el mismo lápiz y la misma digitación que en un PDF. El dibujo
 * propio de la app es el otro modo: aplana las voces y se deja los adornos,
 * pero es el único que puede escribir el nombre de cada nota debajo, que es
 * para lo que está.
 */
export function MusicXmlViewer({ file, annotations }: Props) {
  const { settings } = useSettings();
  const { parsed, xml, error } = useParsedXml(file);
  const player = useScorePlayer(parsed);
  const [names, setNames] = useState(false);
  const [rehearse, setRehearse] = useState(false);
  const [measure, setMeasure] = useState<number | null>(null);

  // En modo espera, lo que se toca en el teclado MIDI es lo que mueve la
  // partitura. Suena por el piano de la app: un controlador no suena solo.
  useMidiNotes((e) => {
    if (!e.on) return;
    if (settings.sound) playNote(e.midi, { duration: 0.9, velocity: Math.max(0.3, e.velocity) * settings.volume });
    player.played(e.midi);
  }, player.practice.follow && player.playing);

  const [tool, setTool] = useState<Tool | null>(null);
  const [color, setColor] = useState(PEN_COLORS[0].value);
  const [highlightColor, setHighlightColor] = useState(DEFAULT_HIGHLIGHT_COLOR);
  const [penWidth, setPenWidth] = useState(DEFAULT_PEN_WIDTH);
  const [linerWidth, setLinerWidth] = useState(DEFAULT_LINER_WIDTH);
  const [finger, setFinger] = useState<Finger>("1");
  const [fingerSize, setFingerSize] = useState(DEFAULT_FINGER_SIZE);
  const [page, setPage] = useState(1);

  if (error) return <p className="text-sm text-bad">{error}</p>;
  if (!parsed) return <p className="text-sm text-ink-2">Leyendo la partitura…</p>;

  const state = {
    tool,
    onTool: (t: Tool) => setTool((cur) => (cur === t ? null : t)),
    color,
    onColor: setColor,
    highlightColor,
    onHighlightColor: setHighlightColor,
    penWidth,
    onPenWidth: setPenWidth,
    linerWidth,
    onLinerWidth: setLinerWidth,
    finger,
    onFinger: setFinger,
    fingerSize,
    onFingerSize: setFingerSize,
  };

  // Escribir es sobre la partitura de verdad: el dibujo con los nombres no
  // tiene páginas, así que allí las herramientas no salen.
  const writable = !!annotations && !names;
  const strokes = annotations?.strokesOf(page) ?? [];

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-2">
        {parsed.measures.length} compases · {keyName(keyByVex(parsed.keyVex), settings.naming)} · {parsed.time.num}/
        {parsed.time.den}
      </p>

      {names || !xml ? (
        <ScoreSheet parsed={parsed} active={player.active} showNames={names} />
      ) : (
        <EngravedScore
          xml={xml}
          position={player.position}
          playing={player.playing}
          onMeasure={setMeasure}
          onPage={setPage}
          overlay={
            writable
              ? (shown, size) => (
                  <ScoreAnnotator
                    width={size.width}
                    height={size.height}
                    strokes={annotations.strokesOf(shown)}
                    onChange={(next) => annotations.onStrokes(shown, next)}
                    tool={tool}
                    color={color}
                    highlightColor={highlightColor}
                    penWidth={penWidth}
                    linerWidth={linerWidth}
                    finger={finger}
                    fingerSize={fingerSize}
                  />
                )
              : undefined
          }
          // un MusicXML que Verovio no entienda se sigue leyendo con el dibujo de la app
          fallback={<ScoreSheet parsed={parsed} active={player.active} showNames={false} />}
        />
      )}

      {/* Los mandos van al pie y se quedan a la vista al desplazar la partitura,
          como en el lector de PDF: se usan mientras se lee, no antes de leer. */}
      <div className="sticky z-10 flex flex-col items-center gap-2" style={{ bottom: "calc(0.75rem + var(--safe-b))" }}>
        {rehearse && (
          <div className="w-full max-w-md">
            <RehearsePanel
              player={player}
              measures={parsed.measures.length}
              staves={parsed.clefs.length === 2 ? ["derecha", "izquierda"] : parsed.clefs.map((_, i) => `pentagrama ${i + 1}`)}
              beatsPerBar={parsed.time.num}
            />
          </div>
        )}
        {writable && <AnnotationOptions state={state} />}

        <div className="card flex max-w-full items-center gap-1.5 overflow-x-auto p-1.5 shadow-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {writable && (
            <AnnotationTools
              state={state}
              onUndo={() => annotations.onStrokes(page, strokes.slice(0, -1))}
              canUndo={strokes.length > 0}
            />
          )}

          <Group>
            <ToolButton
              label={player.playing ? "Detener" : "Escuchar la partitura"}
              active={player.playing}
              disabled={!settings.sound}
              onClick={() => void player.toggle()}
            >
              {player.playing ? <StopIcon /> : <PlayIcon />}
            </ToolButton>
            <ToolButton label={names ? "Ver la partitura original" : "Ver el nombre de cada nota"} active={names} onClick={() => setNames((v) => !v)}>
              <NoteNamesIcon />
            </ToolButton>
            <ToolButton label="Ensayar un trozo" active={rehearse} onClick={() => setRehearse((v) => !v)}>
              <RehearseIcon />
            </ToolButton>
          </Group>

          {/* Por dónde va: el compás es lo que se busca al perderse. */}
          <span className="shrink-0 px-1 text-xs tabular-nums text-ink-2 select-none">
            {player.playing && measure ? (
              <>
                Compás <span className="font-semibold text-ink">{parsed.measures[measure - 1]?.number ?? measure}</span>
              </>
            ) : (
              <span className="text-ink-3">♩ = {player.currentTempo}</span>
            )}
          </span>

          <input
            type="range"
            min={40}
            max={200}
            value={player.tempo}
            onChange={(e) => player.setTempo(Number(e.target.value))}
            disabled={player.playing}
            className="accent-(--accent) w-24 shrink-0 disabled:opacity-40"
            aria-label="Tempo"
          />
        </div>
      </div>

      {!settings.sound && <p className="text-xs text-bad">Activa el sonido en Ajustes para escuchar la partitura.</p>}
    </div>
  );
}

/**
 * Escuchar y a qué velocidad, para las vistas que no son el lector (la ficha
 * de una pieza del catálogo, que no tiene barra de herramientas). Lo que cada
 * una añada de suyo va como hijo.
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
