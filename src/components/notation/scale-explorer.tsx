"use client";

import { useMemo, useState } from "react";
import { Score } from "./score";
import { PianoKeyboard } from "./piano-keyboard";
import { PlayButton } from "@/components/audio/play-button";
import { Select } from "@/components/ui/select";
import { SCALES, buildScale } from "@/lib/music/scales";
import { toMidi, toEasyScore, noteName, parsePitch } from "@/lib/music/pitch";
import { useSettings } from "@/lib/settings";

const TONICS = ["C4", "Db4", "D4", "Eb4", "E4", "F4", "F#4", "G4", "Ab4", "A4", "Bb4", "B4"];

export function ScaleExplorer() {
  const { settings } = useSettings();
  const [tonic, setTonic] = useState("C4");
  const [scaleId, setScaleId] = useState("mayor");
  const [current, setCurrent] = useState(-1);

  const scale = SCALES.find((s) => s.id === scaleId)!;
  const notes = useMemo(() => {
    const t = parsePitch(tonic);
    const s = buildScale(scale, t);
    const top = { ...t, octave: t.octave + 1 };
    return [...s, top];
  }, [tonic, scale]);

  const midis = notes.map(toMidi);
  const measures = useMemo(() => {
    const per = notes.length > 8 ? 7 : 4;
    const out: string[] = [];
    for (let i = 0; i < notes.length; i += per) {
      out.push(notes.slice(i, i + per).map((n) => `${toEasyScore(n)}/q`).join(", "));
    }
    return out;
  }, [notes]);
  const time = notes.length > 8 ? "7/4" : "4/4";
  const labels = notes.map((n) => noteName(n, settings.naming));

  return (
    <div className="card p-4 md:p-5 space-y-4">
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-2">Tónica</span>
          <Select
            variant="pill"
            value={tonic}
            onChange={setTonic}
            options={TONICS.map((t) => ({ value: t, label: noteName(parsePitch(t), settings.naming) }))}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-2">Escala</span>
          <Select variant="pill" value={scaleId} onChange={setScaleId} options={SCALES.map((s) => ({ value: s.id, label: s.name }))} />
        </label>
      </div>
      <p className="text-sm text-ink-2">
        <strong className="text-ink">{scale.formula}</strong> · {scale.description}
      </p>
      <Score measures={measures} time={time} labels={labels} width={notes.length > 8 ? 620 : 520} highlight={current >= 0 ? current : undefined} />
      <PianoKeyboard from={Math.min(...midis) - 1} to={Math.max(...midis) + 1} highlight={current >= 0 ? [midis[current]] : midis} labels="all" />
      <PlayButton
        events={midis.map((m) => ({ midis: [m], beats: 0.5 }))}
        bpm={100}
        label="Escuchar la escala"
        onEvent={setCurrent}
        size="sm"
      />
    </div>
  );
}
