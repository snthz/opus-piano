import { LessonLayout, Section, P, Figure } from "@/components/lesson/lesson-layout";
import { Callout } from "@/components/lesson/callout";
import { Score } from "@/components/notation/score";
import { Glyph } from "@/components/notation/glyph";
import { PlayButton } from "@/components/audio/play-button";
import { MeterDemo } from "@/components/audio/meter-demo";
import { TIME_SIGNATURES, TIME_SIGNATURE_BY_ID } from "@/lib/music/meter";

export const metadata = { title: "Los compases" };

const G = 67;
const n = (beats: number, count = 1, midi = G) => Array.from({ length: count }, () => ({ midis: [midi], beats }));

export default function Page() {
  return (
    <LessonLayout slug="compases">
      <Section title="Pulso, tempo y acento">
        <P>
          Casi toda la música tiene un <strong>pulso</strong> regular, como el latido del corazón: es lo que
          marcas con el pie. La velocidad del pulso es el <strong>tempo</strong> y se indica con una marca
          metronómica <Glyph name="metNoteQuarterUp" inline size={22} /> = 120 (120 negras por minuto) o con
          palabras italianas: <em>adagio</em> (lento), <em>andante</em> (tranquilo), <em>moderato</em>,{" "}
          <em>allegro</em> (rápido), <em>presto</em> (muy rápido).
        </P>
        <P>
          Los pulsos no suenan todos igual: algunos son <strong>fuertes</strong> y otros{" "}
          <strong>débiles</strong>, y se repiten en ciclos. Ese ciclo es el <strong>compás</strong>. Si
          cuentas «UN-dos, UN-dos» estás en un compás de dos; «UN-dos-tres» es de tres.
        </P>
      </Section>

      <Section title="La cifra de compás">
        <P>
          Al principio de la partitura, tras la clave y la armadura, aparecen dos números uno sobre otro. En
          los compases <strong>simples</strong> el número de <strong>arriba</strong> dice cuántos pulsos hay
          por compás y el de <strong>abajo</strong>, qué figura vale un pulso: 4 = negra, 8 = corchea,
          2 = blanca. Así, 3/4 son tres negras por compás.
        </P>
        <div className="grid grid-cols-2 gap-3">
          {[
            { g: "timeSigCommon", t: "Compasillo", d: "= 4/4" },
            { g: "timeSigCutCommon", t: "Compasillo cortado", d: "= 2/2" },
          ].map((c) => (
            <div key={c.g} className="card p-4 flex items-center gap-4">
              <Glyph name={c.g} size={48} label={c.t} />
              <span>
                <span className="block font-semibold">{c.t}</span>
                <span className="block text-sm text-ink-2">{c.d}</span>
              </span>
            </div>
          ))}
        </div>
        <P>
          Las <strong>barras de compás</strong> <Glyph name="barlineSingle" inline size={22} /> separan un
          compás del siguiente. La <strong>doble barra</strong> <Glyph name="barlineDouble" inline size={22} />{" "}
          marca el fin de una sección y la <strong>barra final</strong>{" "}
          <Glyph name="barlineFinal" inline size={22} /> el fin de la pieza. El primer pulso de cada compás,
          justo después de la barra, es el fuerte.
        </P>
      </Section>

      <Section title="Compases simples: 2/4, 3/4 y 4/4">
        <P>
          En un compás simple cada pulso se divide en <strong>dos</strong> (una negra son dos corcheas). Los
          más comunes son el binario 2/4, el ternario 3/4 y el cuaternario 4/4.
        </P>
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>2/4: fuerte–débil. Típico de marchas.</span>
              <PlayButton events={[...n(1, 2), ...n(0.5, 4), ...n(1), ...n(0.5, 2), ...n(2)]} bpm={100} beatsPerBar={2} metronome size="sm" />
            </span>
          }
        >
          <Score time="2/4" measures={["G4/q, G4", "G4/8, G4, G4, G4", "G4/q, G4/8, G4", "G4/h"]} width={560} endBar="end" />
        </Figure>
        <MeterDemo ts={TIME_SIGNATURE_BY_ID["2-4"]} />
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>3/4: fuerte–débil–débil. El compás del vals.</span>
              <PlayButton events={[...n(1, 3), ...n(2), ...n(1), ...n(1), ...n(0.5, 4), ...n(3)]} bpm={110} beatsPerBar={3} metronome size="sm" />
            </span>
          }
        >
          <Score time="3/4" measures={["G4/q, G4, G4", "G4/h, G4/q", "G4/q, G4/8, G4, G4, G4", "G4/h."]} width={560} endBar="end" />
        </Figure>
        <MeterDemo ts={TIME_SIGNATURE_BY_ID["3-4"]} />
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>4/4: fuerte–débil–semifuerte–débil. El más usado en pop y rock.</span>
              <PlayButton events={[...n(1, 4), ...n(2), ...n(1, 2), ...n(0.5, 4), ...n(2), ...n(4)]} bpm={100} beatsPerBar={4} metronome size="sm" />
            </span>
          }
        >
          <Score time="4/4" measures={["G4/q, G4, G4, G4", "G4/h, G4/q, G4", "G4/8, G4, G4, G4, G4/h", "G4/w"]} width={600} endBar="end" />
        </Figure>
        <MeterDemo ts={TIME_SIGNATURE_BY_ID["4-4"]} />
      </Section>

      <Section title="Compases compuestos: 6/8, 9/8 y 12/8">
        <P>
          En un compás compuesto cada pulso se divide en <strong>tres</strong>. El pulso es una{" "}
          <strong>negra con puntillo</strong> (tres corcheas). Por eso el 6/8 no se cuenta «a seis», sino{" "}
          <strong>a dos</strong>: «UN-y-y, DOS-y-y». Para saber los pulsos de un compás compuesto, divide el
          número de arriba entre 3: 6/8 → 2 pulsos, 9/8 → 3, 12/8 → 4.
        </P>
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>6/8: las barras agrupan las corcheas de tres en tres, una por pulso.</span>
              <PlayButton events={[...n(0.5, 6), ...n(1, 1), ...n(0.5, 1), ...n(1.5, 1), ...n(0.5, 3), ...n(1.5), ...n(3)]} bpm={100} beatsPerBar={3} metronome size="sm" />
            </span>
          }
        >
          <Score time="6/8" measures={["G4/8, G4, G4, G4, G4, G4", "G4/q, G4/8, G4/q.", "G4/8, G4, G4, G4/q.", "G4/h."]} width={600} endBar="end" />
        </Figure>
        <MeterDemo ts={TIME_SIGNATURE_BY_ID["6-8"]} initialBpm={70} />
        <Callout kind="tip" title="¿3/4 o 6/8?">
          Los dos tienen seis corcheas, pero el 3/4 las agrupa <strong>2+2+2</strong> (tres pulsos) y el 6/8,{" "}
          <strong>3+3</strong> (dos pulsos). Escucha dónde caen los acentos: «un-y dos-y tres-y» frente a
          «UN-y-y DOS-y-y».
        </Callout>
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>Las mismas seis corcheas en 3/4 (arriba) y 6/8 (abajo). Fíjate en las barras.</span>
              <PlayButton events={[...n(0.5, 6)]} bpm={120} beatsPerBar={3} metronome size="sm" label="3/4" />
              <PlayButton events={[...n(0.5, 6)]} bpm={120} beatsPerBar={3} metronome size="sm" label="6/8" />
            </span>
          }
        >
          <Score time="3/4" measures={["G4/8, G4, G4, G4, G4, G4"]} width={420} />
          <Score time="6/8" measures={["G4/8, G4, G4, G4, G4, G4"]} width={420} className="mt-2" />
        </Figure>
      </Section>

      <Section title="Anacrusa">
        <P>
          Muchas melodías empiezan con una o varias notas <em>antes</em> del primer pulso fuerte. Ese compás
          inicial incompleto se llama <strong>anacrusa</strong>. Normalmente el último compás de la pieza
          completa lo que falta.
        </P>
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>«Cumpleaños feliz» empieza en anacrusa: dos corcheas antes del primer compás completo.</span>
              <PlayButton
                events={[
                  { midis: [67], beats: 0.75 },
                  { midis: [67], beats: 0.25 },
                  { midis: [69], beats: 1 },
                  { midis: [67], beats: 1 },
                  { midis: [72], beats: 1 },
                  { midis: [71], beats: 2 },
                ]}
                bpm={100}
                size="sm"
              />
            </span>
          }
        >
          <Score time="3/4" measures={["G4/8., G4/16", "A4/q, G4, C5", "B4/h."]} width={520} endBar="double" />
        </Figure>
      </Section>

      <Section title="Compases irregulares">
        <P>
          Los compases de 5 o 7 pulsos se sienten como la suma de grupos de 2 y 3: un 5/4 suele ser 3+2 o
          2+3; un 7/8, 2+2+3. Son habituales en la música balcánica, el jazz y el rock progresivo.
        </P>
        <Figure caption="5/4 agrupado 3+2: fíjate en cómo se agrupan las corcheas.">
          <Score time="5/4" measures={["G4/8, G4, G4, G4, G4, G4, G4, G4, G4, G4"]} width={520} />
        </Figure>
        <MeterDemo ts={TIME_SIGNATURE_BY_ID["5-4"]} initialBpm={110} />
      </Section>

      <Section title="Todos los compases de un vistazo">
        <div className="grid gap-3">
          {TIME_SIGNATURES.map((ts) => (
            <div key={ts.id} className="card p-4 flex gap-4">
              <div className="w-14 shrink-0 text-center">
                <span className="block text-2xl font-bold leading-none tabular-nums">{ts.numerator}</span>
                <span className="block text-2xl font-bold leading-none tabular-nums border-t border-ink mt-0.5 pt-0.5">
                  {ts.denominator}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold leading-tight">{ts.name}</p>
                <p className="text-xs text-ink-3 mt-0.5">
                  {ts.beats} pulsos · subdivisión {ts.subdivision === "mixta" ? "mixta" : ts.subdivision === 2 ? "binaria" : "ternaria"}
                </p>
                <p className="text-sm text-ink-2 mt-1.5">{ts.description}</p>
                <p className="text-xs text-ink-3 mt-1.5">Ejemplos: {ts.examples.join(", ")}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </LessonLayout>
  );
}
