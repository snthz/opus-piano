import { LessonLayout, Section, P, Figure } from "@/components/lesson/lesson-layout";
import { Callout } from "@/components/lesson/callout";
import { Score } from "@/components/notation/score";
import { Glyph } from "@/components/notation/glyph";
import { GlyphIcon } from "@/components/notation/glyph-icon";
import { PlayButton } from "@/components/audio/play-button";
import { FIGURES } from "@/lib/music/durations";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Figuras y silencios: cuánto dura cada nota",
  description:
    "Redonda, blanca, negra, corchea y semicorchea, sus silencios equivalentes y los tres modificadores de duración: puntillo, ligadura y tresillo.",
  path: "/theory/note-values",
  keywords: ["figuras musicales", "duración de las notas", "redonda blanca negra corchea", "silencios musicales", "puntillo"],
  type: "article",
});

const G = 67;
const ev = (beats: number, n = 1) => Array.from({ length: n }, () => ({ midis: [G], beats }));

export default function Page() {
  return (
    <LessonLayout slug="figuras">
      <Section title="La duración se escribe con la forma de la nota">
        <P>
          La posición en el pentagrama dice <em>qué</em> nota es; la <strong>figura</strong> (la forma de la
          nota) dice <em>cuánto dura</em>. Cada figura vale exactamente la <strong>mitad</strong> de la
          anterior. La referencia habitual es la <strong>negra</strong>, que suele coincidir con el pulso.
        </P>
        <div className="card p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-ink-3 text-left">
              <tr>
                <th className="font-medium py-1">Figura</th>
                <th className="font-medium">Nombre</th>
                <th className="font-medium text-center">Silencio</th>
                <th className="font-medium text-right">Valor (negras)</th>
                <th className="font-medium text-right">En un 4/4</th>
              </tr>
            </thead>
            <tbody>
              {FIGURES.map((f) => (
                <tr key={f.id} className="border-t border-line">
                  <td className="py-2 w-14">
                    <GlyphIcon name={f.noteGlyph} size={34} fit="em" label={f.name} />
                  </td>
                  <td>
                    <span className="font-semibold">{f.name}</span>
                    <span className="block text-xs text-ink-3">
                      {f.english}
                      {f.altNames.length ? ` · ${f.altNames.join(", ")}` : ""}
                    </span>
                  </td>
                  <td className="text-center">
                    <GlyphIcon name={f.restGlyph} size={34} fit="em" label={f.restName} />
                  </td>
                  <td className="text-right tabular-nums">{f.beats}</td>
                  <td className="text-right tabular-nums text-ink-2">{4 / f.beats}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>Redonda, dos blancas, cuatro negras y ocho corcheas: cada compás dura lo mismo.</span>
              <PlayButton events={[...ev(4), ...ev(2, 2), ...ev(1, 4), ...ev(0.5, 8)]} bpm={100} beatsPerBar={4} metronome size="sm" />
            </span>
          }
        >
          <Score time="4/4" measures={["G4/w", "G4/h, G4", "G4/q, G4, G4, G4", "G4/8, G4, G4, G4, G4, G4, G4, G4"]} width={640} endBar="end" />
        </Figure>
      </Section>

      <Section title="Partes de la nota">
        <P>
          Una nota tiene <strong>cabeza</strong> (blanca o negra), <strong>plica</strong> (el palito) y, en las
          figuras cortas, <strong>corchetes</strong>. La plica va hacia arriba cuando la nota está por debajo
          de la tercera línea y hacia abajo cuando está por encima; en la tercera línea puede ir hacia
          cualquiera de los dos lados.
        </P>
        <Figure caption="Plicas hacia arriba en las notas graves y hacia abajo en las agudas.">
          <Score measures={["D4/q, F4, A4, B4, C5, E5, G5, B5"]} time="8/4" width={560} />
        </Figure>
        <P>
          Cuando varias corcheas o semicorcheas van seguidas, sus corchetes se sustituyen por{" "}
          <strong>barras</strong> que las unen en grupos. Es solo una forma más legible de escribir lo mismo:
          las barras muestran dónde cae cada pulso.
        </P>
        <Figure caption="Las mismas corcheas y semicorcheas, sueltas (arriba) y agrupadas con barras (abajo).">
          <Score time="4/4" measures={["C4/8, D4, E4, F4, G4/16, A4, B4, C5, D5/8, C5"]} beams={false} width={520} />
          <Score time="4/4" measures={["C4/8, D4, E4, F4, G4/16, A4, B4, C5, D5/8, C5"]} beams width={520} className="mt-2" />
        </Figure>
      </Section>

      <Section title="El puntillo">
        <P>
          Un punto a la derecha de la cabeza <Glyph name={["noteQuarterUp", "augmentationDot"]} inline size={24} />{" "}
          añade a la nota <strong>la mitad de su valor</strong>. Una blanca con puntillo dura 3 negras; una
          negra con puntillo, 1½ negras (una negra más una corchea). Un doble puntillo añade además la mitad
          de la mitad.
        </P>
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>Blanca con puntillo + negra, y negra con puntillo + corchea: patrones muy frecuentes.</span>
              <PlayButton events={[...ev(3), ...ev(1), ...ev(1.5), ...ev(0.5), ...ev(1.5), ...ev(0.5)]} bpm={100} beatsPerBar={4} metronome size="sm" />
            </span>
          }
        >
          <Score time="4/4" measures={["G4/h., G4/q", "G4/q., G4/8, G4/q., G4/8"]} width={520} endBar="end" />
        </Figure>
      </Section>

      <Section title="La ligadura de prolongación">
        <P>
          Una curva que une dos notas <strong>de la misma altura</strong> las convierte en una sola de
          duración sumada: se toca la primera y se mantiene durante la segunda sin volver a atacar. Sirve para
          prolongar una nota a través de la barra de compás o para crear duraciones que no existen como figura.
        </P>
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>La blanca ligada a la negra suena como una sola nota de 3 pulsos que cruza el compás.</span>
              <PlayButton events={[...ev(1, 2), ...ev(3), ...ev(1), ...ev(2)]} bpm={100} beatsPerBar={4} metronome size="sm" />
            </span>
          }
        >
          <Score time="4/4" measures={["G4/q, G4, G4/h", "G4/q, G4, G4/h"]} ties={[[2, 3]]} width={520} endBar="end" />
        </Figure>
        <Callout kind="warn" title="No confundir con la ligadura de expresión">
          La ligadura de <em>expresión</em> une notas de <strong>distinta</strong> altura y significa tocarlas
          ligadas (legato), sin separación. La de <em>prolongación</em> une notas <strong>iguales</strong> y
          suma su duración.
        </Callout>
        <Figure caption="Ligadura de expresión (legato) sobre cuatro notas distintas.">
          <Score time="4/4" measures={["C4/q, D4, E4, F4"]} slurs={[[0, 3]]} width={420} />
        </Figure>
      </Section>

      <Section title="El tresillo">
        <P>
          A veces se quieren meter <strong>tres notas en el tiempo de dos</strong>. Se escriben con un{" "}
          <strong>3</strong> sobre el grupo: un tresillo de corcheas dura lo mismo que dos corcheas (una negra).
          Cada nota del tresillo vale un tercio del pulso.
        </P>
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>Dos corcheas normales y luego un tresillo de corcheas en el mismo pulso.</span>
              <PlayButton events={[...ev(0.5, 2), ...ev(1 / 3, 3), ...ev(0.5, 2), ...ev(1 / 3, 3)]} bpm={80} beatsPerBar={4} metronome size="sm" />
            </span>
          }
        >
          <Score time="2/4" measures={["G4/8, G4, G4/8, G4, G4", "G4/8, G4, G4/8, G4, G4"]} tuplets={[[2, 3], [7, 3]]} width={520} endBar="end" />
        </Figure>
      </Section>

      <Section title="Los silencios">
        <P>
          Cada figura tiene su <strong>silencio</strong>, que vale lo mismo pero sin sonido. Los silencios
          cuentan igual que las notas: no se saltan. El silencio de redonda cuelga de la cuarta línea y el de
          blanca se apoya sobre la tercera; una forma de recordarlo es que la redonda «pesa más» y cuelga.
        </P>
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>Notas y silencios alternados. Cuenta en voz alta: «1, 2, 3, 4».</span>
              <PlayButton
                events={[
                  { midis: [G], beats: 1 },
                  { midis: [], beats: 1 },
                  { midis: [G], beats: 1 },
                  { midis: [], beats: 1 },
                  { midis: [G], beats: 0.5 },
                  { midis: [], beats: 0.5 },
                  { midis: [G], beats: 0.5 },
                  { midis: [], beats: 0.5 },
                  { midis: [G], beats: 2 },
                ]}
                bpm={100}
                beatsPerBar={4}
                metronome
                size="sm"
              />
            </span>
          }
        >
          <Score time="4/4" measures={["G4/q, B4/q/r, G4/q, B4/q/r", "G4/8, B4/8/r, G4/8, B4/8/r, G4/h"]} width={520} endBar="end" />
        </Figure>
        <Callout kind="info" title="Resumen">
          <ul className="list-disc pl-4 space-y-1">
            <li>Redonda = 2 blancas = 4 negras = 8 corcheas = 16 semicorcheas.</li>
            <li>Puntillo: + la mitad del valor. Ligadura: suma dos notas iguales.</li>
            <li>Tresillo: 3 notas en el tiempo de 2.</li>
            <li>Cada figura tiene un silencio del mismo valor.</li>
          </ul>
        </Callout>
      </Section>
    </LessonLayout>
  );
}
