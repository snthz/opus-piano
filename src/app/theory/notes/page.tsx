import Link from "next/link";
import { LessonLayout, Section, P, Figure } from "@/components/lesson/lesson-layout";
import { Callout } from "@/components/lesson/callout";
import { Score } from "@/components/notation/score";
import { Glyph } from "@/components/notation/glyph";
import { PianoKeyboard } from "@/components/notation/piano-keyboard";
import { NoteExplorer } from "@/components/notation/note-explorer";
import { PlayButton } from "@/components/audio/play-button";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Las notas musicales y el teclado del piano",
  description:
    "Los nombres de las notas, las octavas, los sostenidos y bemoles, las enarmonías y cómo encontrar cada nota del pentagrama en las teclas del piano.",
  path: "/theory/notes",
  keywords: ["notas musicales", "notas en el piano", "octavas", "sostenidos y bemoles", "enarmonía"],
  type: "article",
});

const NAMES = [
  ["do", "C"],
  ["re", "D"],
  ["mi", "E"],
  ["fa", "F"],
  ["sol", "G"],
  ["la", "A"],
  ["si", "B"],
];

export default function Page() {
  return (
    <LessonLayout slug="notas">
      <Section title="Siete nombres que se repiten">
        <P>
          Solo hay <strong>siete nombres de nota</strong>: do, re, mi, fa, sol, la, si. Después del si vuelve
          el do, una <strong>octava</strong> más aguda, y la serie se repite por todo el teclado. En el
          sistema anglosajón (muy común en internet y en cifrados de acordes) se usan letras.
        </P>
        <div className="card p-4 overflow-x-auto">
          <table className="w-full text-sm text-center">
            <thead className="text-ink-3">
              <tr>
                <th className="text-left font-medium py-1">Sistema</th>
                {NAMES.map(([l]) => (
                  <th key={l} className="font-medium">
                    {" "}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line">
                <td className="text-left py-2 font-medium">Latino</td>
                {NAMES.map(([l]) => (
                  <td key={l} className="py-2 font-semibold">
                    {l}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-line">
                <td className="text-left py-2 font-medium">Anglosajón</td>
                {NAMES.map(([, e]) => (
                  <td key={e} className="py-2 font-semibold">
                    {e}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <Callout kind="info">
          Puedes elegir qué sistema muestra la app en los ejercicios y el teclado desde{" "}
          <Link href="/settings" className="underline">
            Ajustes
          </Link>
          . Las lecciones usan el sistema latino y añaden la letra cuando ayuda.
        </Callout>
      </Section>

      <Section title="Las octavas y el do central">
        <P>
          Para distinguir un do de otro se numeran las octavas: cada nueva octava empieza en un do. El{" "}
          <strong>do central</strong> del piano es <strong>do4</strong> (C4). El la que se usa para afinar,
          la4 (A4), vibra a 440 Hz. Un piano completo va desde la0 hasta do8.
        </P>
        <Figure caption="Tres octavas alrededor del do central. Toca las teclas para oírlas; el punto marca el do4.">
          <PianoKeyboard from={48} to={84} labels="c" />
        </Figure>
      </Section>

      <Section title="Orientarse en el teclado">
        <P>
          Las teclas negras se agrupan de <strong>dos</strong> y de <strong>tres</strong>. Ese patrón es el
          mapa del teclado: el <strong>do</strong> es siempre la tecla blanca justo a la izquierda del grupo
          de dos negras, y el <strong>fa</strong>, la que está a la izquierda del grupo de tres.
        </P>
        <Figure caption="Todos los do (a la izquierda del grupo de dos negras) resaltados en naranja y los fa (a la izquierda del grupo de tres) en verde.">
          <PianoKeyboard from={48} to={84} labels="none" highlight={[48, 60, 72, 84]} highlightAlt={[53, 65, 77]} markMiddleC={false} />
        </Figure>
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>Las siete notas naturales de una octava, en el pentagrama y en el teclado.</span>
              <PlayButton events={[60, 62, 64, 65, 67, 69, 71].map((m) => ({ midis: [m], beats: 0.75 }))} bpm={100} size="sm" />
            </span>
          }
        >
          <Score measures={["C4/q, D4, E4, F4, G4, A4, B4"]} time="7/4" labels={["do", "re", "mi", "fa", "sol", "la", "si"]} width={520} />
          <PianoKeyboard from={60} to={71} labels="all" highlight={[60, 62, 64, 65, 67, 69, 71]} className="mt-3" />
        </Figure>
      </Section>

      <Section title="Tono y semitono">
        <P>
          La distancia entre dos teclas <em>consecutivas</em> (contando blancas y negras) es un{" "}
          <strong>semitono</strong>. Dos semitonos forman un <strong>tono</strong>. Entre la mayoría de
          teclas blancas hay una negra en medio (un tono), pero entre <strong>mi–fa</strong> y{" "}
          <strong>si–do</strong> no hay tecla negra: están a solo un semitono.
        </P>
        <Figure caption="Mi–fa y si–do: los dos semitonos «naturales» del teclado.">
          <PianoKeyboard from={60} to={72} labels="all" highlight={[64, 65, 71, 72]} markMiddleC={false} />
        </Figure>
      </Section>

      <Section title="Alteraciones: sostenido, bemol y becuadro">
        <P>
          Las teclas negras no tienen nombre propio: se nombran a partir de la blanca vecina con una{" "}
          <strong>alteración</strong>. El <strong>sostenido</strong> <Glyph name="accidentalSharp" inline size={22} />{" "}
          sube la nota un semitono (tecla de la derecha); el <strong>bemol</strong>{" "}
          <Glyph name="accidentalFlat" inline size={22} /> la baja un semitono (tecla de la izquierda); el{" "}
          <strong>becuadro</strong> <Glyph name="accidentalNatural" inline size={22} /> anula la alteración y
          devuelve la nota natural.
        </P>
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>do – do♯ – re – re♭ – re♮. Fíjate en que do♯ y re♭ son la misma tecla.</span>
              <PlayButton events={[60, 61, 62, 61, 62].map((m) => ({ midis: [m], beats: 1 }))} bpm={90} size="sm" />
            </span>
          }
        >
          <Score measures={["C4/q, C#4, D4, Db4, Dn4"]} time="5/4" labels={["do", "do♯", "re", "re♭", "re♮"]} width={520} />
          <PianoKeyboard from={60} to={64} labels="all" highlight={[61]} markMiddleC={false} className="mt-3 max-w-xs" />
        </Figure>
        <Callout kind="warn" title="Regla del compás">
          Una alteración escrita delante de una nota vale para <strong>todas las notas iguales</strong> (misma
          altura) hasta el final del compás. En el compás siguiente deja de tener efecto, salvo que esté en la
          armadura (lección 7).
        </Callout>
      </Section>

      <Section title="Enarmonía">
        <P>
          Una misma tecla puede escribirse de dos maneras: do♯ es la misma tecla que re♭, fa♯ que sol♭, etc.
          Se llaman notas <strong>enarmónicas</strong>. Cuál de las dos se usa depende de la tonalidad y del
          contexto musical; incluso mi♯ (= fa) o do♭ (= si) aparecen en algunas partituras.
        </P>
        <div className="grid grid-cols-5 gap-2 text-center text-sm">
          {[
            ["do♯", "re♭"],
            ["re♯", "mi♭"],
            ["fa♯", "sol♭"],
            ["sol♯", "la♭"],
            ["la♯", "si♭"],
          ].map(([a, b]) => (
            <div key={a} className="card-pastel bg-ash py-3">
              <span className="block font-semibold">{a}</span>
              <span className="block text-ink-2 text-xs">=</span>
              <span className="block font-semibold">{b}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Explora las notas">
        <P>
          Recorre el pentagrama nota a nota y observa dónde cae cada una en el teclado. Es la mejor forma de
          fijar la relación entre lo escrito y lo que tocas.
        </P>
        <NoteExplorer />
      </Section>
    </LessonLayout>
  );
}
