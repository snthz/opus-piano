import { LessonLayout, Section, P, Figure } from "@/components/lesson/lesson-layout";
import { Callout } from "@/components/lesson/callout";
import { Score } from "@/components/notation/score";
import { Glyph } from "@/components/notation/glyph";
import { PlayButton } from "@/components/audio/play-button";
import { CircleOfFifths } from "@/components/notation/circle-of-fifths";
import { MAJOR_KEYS, keyName, relativeKey, keyAccidentals } from "@/lib/music/keys";
import { LATIN_NAMES } from "@/lib/music/pitch";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Armaduras: sostenidos, bemoles y tonalidad",
  description:
    "Cómo se lee la armadura de una partitura, en qué orden aparecen los sostenidos y los bemoles, el círculo de quintas y los relativos mayores y menores.",
  path: "/theory/key-signatures",
  keywords: ["armadura musical", "tonalidad", "círculo de quintas", "sostenidos y bemoles", "relativo menor"],
  type: "article",
});

export default function Page() {
  const sharps = MAJOR_KEYS.filter((k) => k.fifths >= 0).sort((a, b) => a.fifths - b.fifths);
  const flats = MAJOR_KEYS.filter((k) => k.fifths < 0).sort((a, b) => b.fifths - a.fifths);
  return (
    <LessonLayout slug="armaduras">
      <Section title="¿Qué es la armadura?">
        <P>
          La <strong>armadura</strong> es el grupo de sostenidos o bemoles escrito justo después de la clave.
          A diferencia de las alteraciones sueltas, vale durante <strong>toda la pieza</strong> (hasta que
          aparezca otra armadura) y para <strong>todas las octavas</strong>: si la armadura tiene fa♯, todos
          los fa de la partitura son fa♯ aunque no lleven nada escrito.
        </P>
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>Armadura de Sol mayor (un sostenido): todos los fa son fa♯ aunque no se escriba.</span>
              <PlayButton events={[67, 69, 71, 72, 74, 76, 78, 79].map((m) => ({ midis: [m], beats: 0.5 }))} bpm={100} size="sm" />
            </span>
          }
        >
          <Score keySignature="G" time="4/4" measures={["G4/8, A4, B4, C5, D5, E5, F5, G5"]} labels={["sol", "la", "si", "do", "re", "mi", "fa♯", "sol"]} width={520} endBar="end" />
        </Figure>
        <P>
          La armadura nos dice en qué <strong>tonalidad</strong> está la música: qué escala usa y cuál es su
          nota «casa» o <strong>tónica</strong>. Cada armadura corresponde a una tonalidad mayor y a su
          relativa menor.
        </P>
      </Section>

      <Section title="El orden de los sostenidos y los bemoles">
        <P>
          Los sostenidos siempre se añaden en el mismo orden: <strong>fa, do, sol, re, la, mi, si</strong>{" "}
          (cada uno una quinta por encima del anterior). Los bemoles siguen el orden inverso:{" "}
          <strong>si, mi, la, re, sol, do, fa</strong>. Por eso una armadura con dos sostenidos siempre es
          fa♯ y do♯, nunca otra combinación.
        </P>
        <Figure caption="Los siete sostenidos en orden (Do♯ mayor) y los siete bemoles (Do♭ mayor).">
          <Score keySignature="C#" measures={[""]} width={300} height={110} />
          <Score keySignature="Cb" measures={[""]} width={300} height={110} className="mt-1" />
        </Figure>
        <div className="grid grid-cols-2 gap-3">
          <div className="card-pastel bg-yellow p-4">
            <p className="text-xs text-ink-2">Orden de sostenidos</p>
            <p className="font-semibold mt-1">fa do sol re la mi si</p>
          </div>
          <div className="card-pastel bg-blue p-4">
            <p className="text-xs text-ink-2">Orden de bemoles</p>
            <p className="font-semibold mt-1">si mi la re sol do fa</p>
          </div>
        </div>
      </Section>

      <Section title="Cómo saber la tonalidad">
        <P>
          <strong>Con sostenidos:</strong> la tónica mayor está medio tono <em>por encima</em> del último
          sostenido. Si el último es do♯, la tonalidad es Re mayor.
        </P>
        <P>
          <strong>Con bemoles:</strong> la tónica mayor es el <em>penúltimo</em> bemol. Con si♭ y mi♭, la
          tonalidad es Si♭ mayor. (Con un solo bemol, si♭, es Fa mayor: hay que memorizarlo.)
        </P>
        <P>
          <strong>Sin alteraciones:</strong> Do mayor o su relativa la menor.
        </P>
        <Callout kind="tip" title="¿Mayor o menor?">
          Cada armadura sirve para dos tonalidades: la mayor y su <strong>relativa menor</strong>, que está
          una tercera menor (tres semitonos) por debajo. Do mayor / la menor, Sol mayor / mi menor, Fa mayor /
          re menor… Para distinguirlas mira la nota final de la pieza o del bajo: suele ser la tónica. En
          modo menor, además, aparece a menudo el 7.º grado elevado con una alteración (sol♯ en la menor).
        </Callout>
      </Section>

      <Section title="El círculo de quintas">
        <P>
          Si ordenas las tonalidades subiendo de quinta en quinta (do → sol → re → la…) cada paso añade un
          sostenido. Bajando de quinta (do → fa → si♭ → mi♭…) cada paso añade un bemol. El resultado es el{" "}
          <strong>círculo de quintas</strong>: fuera, las tonalidades mayores; dentro, sus relativas menores;
          en el centro, el número de alteraciones.
        </P>
        <Figure caption="Las tonalidades vecinas en el círculo comparten casi todas sus notas, por eso suenan «cercanas».">
          <CircleOfFifths />
        </Figure>
      </Section>

      <Section title="Todas las armaduras">
        <P>Las quince armaduras mayores con su relativa menor. Las tres últimas de cada lado son enarmónicas entre sí (Si = Do♭, Fa♯ = Sol♭, Do♯ = Re♭).</P>
        <div className="grid gap-3">
          {[...sharps, ...flats].map((k) => {
            const rel = relativeKey(k);
            const { letters, accidental } = keyAccidentals(k);
            const acc = letters.map((l) => `${LATIN_NAMES[l]}${accidental === 1 ? "♯" : "♭"}`).join(", ");
            return (
              <div key={k.vex} className="card p-3 flex items-center gap-3">
                <div className="w-36 shrink-0">
                  <Score keySignature={k.vex} measures={[""]} width={150} height={90} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">
                    {keyName(k)} <span className="text-ink-3 font-normal">/ {keyName(rel)}</span>
                  </p>
                  <p className="text-xs text-ink-2 mt-0.5">
                    {k.fifths === 0 ? "Sin alteraciones" : `${Math.abs(k.fifths)} ${k.fifths > 0 ? "sostenido" : "bemol"}${Math.abs(k.fifths) > 1 ? (k.fifths > 0 ? "s" : "es") : ""}: ${acc}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Alteraciones dentro del compás">
        <P>
          Una alteración escrita delante de una nota (<Glyph name="accidentalSharp" inline size={20} />,{" "}
          <Glyph name="accidentalFlat" inline size={20} />, <Glyph name="accidentalNatural" inline size={20} />)
          tiene prioridad sobre la armadura, pero solo hasta el final del compás y solo en esa octava. El{" "}
          <strong>becuadro</strong> se usa para cancelar temporalmente una alteración de la armadura.
        </P>
        <Figure caption="En Fa mayor (si♭ en la armadura) el becuadro convierte el si♭ en si natural durante ese compás; en el siguiente vuelve a ser si♭.">
          <Score keySignature="F" time="4/4" measures={["F4/q, A4, Bn4, C5", "Bb4/h, A4/h"]} labels={["fa", "la", "si♮", "do", "si♭", "la"]} width={520} endBar="end" />
        </Figure>
      </Section>
    </LessonLayout>
  );
}
