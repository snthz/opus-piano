import Link from "next/link";
import { LessonLayout, Section, P, Figure } from "@/components/lesson/lesson-layout";
import { Callout } from "@/components/lesson/callout";
import { Score } from "@/components/notation/score";
import { Glyph } from "@/components/notation/glyph";
import { GlyphIcon } from "@/components/notation/glyph-icon";
import { PianoKeyboard } from "@/components/notation/piano-keyboard";
import { PlayButton } from "@/components/audio/play-button";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Técnica de piano: dedos, pulgar y dos manos",
  description:
    "La numeración de los dedos, la posición de do, el paso del pulgar en la escala, el pedal derecho y los primeros ejercicios de lectura a dos manos.",
  path: "/theory/piano",
  keywords: ["técnica de piano", "digitación piano", "numeración de los dedos", "paso del pulgar", "tocar con las dos manos"],
  type: "article",
});

const fiveFinger = [60, 62, 64, 65, 67, 65, 64, 62, 60];

export default function Page() {
  return (
    <LessonLayout slug="piano">
      <Section title="Antes de empezar: la postura">
        <P>
          Esta lección da por hecho que ya estás bien sentado: en la mitad delantera de la banqueta, con los{" "}
          <strong>antebrazos horizontales</strong> y los pies en el suelo. Si aún no lo has ajustado, la
          lección de{" "}
          <Link href="/theory/posture" className="underline underline-offset-2">
            postura y posición de la mano
          </Link>{" "}
          lo explica con ilustraciones y ejercicios; aquí va solo el resumen.
        </P>
        <ul className="grid sm:grid-cols-2 gap-3 text-sm">
          {[
            ["Hombros bajos", "Sin tensión; el peso del brazo cae hacia las teclas."],
            ["Muñeca flexible", "Ni caída ni levantada: alineada con el antebrazo."],
            ["Dedos curvos", "Como si sostuvieras una pelota; se toca con la yema."],
            ["Pulgar relajado", "Toca con el lateral de la punta, no con la articulación."],
          ].map(([t, d]) => (
            <li key={t} className="card p-4">
              <span className="block font-semibold">{t}</span>
              <span className="block text-ink-2 mt-0.5">{d}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Numeración de los dedos">
        <P>
          En las partituras los dedos se indican con números: <strong>1</strong> pulgar, <strong>2</strong>{" "}
          índice, <strong>3</strong> corazón, <strong>4</strong> anular y <strong>5</strong> meñique. Es igual
          en las dos manos: el pulgar es siempre el 1. Los números se escriben encima o debajo de la nota.
        </P>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="card w-14 h-14 flex items-center justify-center">
              <GlyphIcon name={`fingering${n}`} size={30} label={`dedo ${n}`} />
            </div>
          ))}
        </div>
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>Ejercicio de cinco dedos en posición de do. Mano derecha: 1-2-3-4-5-4-3-2-1.</span>
              <PlayButton events={fiveFinger.map((m, i) => ({ midis: [m], beats: i === 8 ? 4 : 1 }))} bpm={90} beatsPerBar={4} metronome size="sm" />
            </span>
          }
        >
          <Score time="4/4" measures={["C4/q, D4, E4, F4", "G4/q, F4, E4, D4", "C4/w"]} labels={["1", "2", "3", "4", "5", "4", "3", "2", "1"]} labelPosition="above" width={560} endBar="end" />
          <PianoKeyboard from={60} to={67} highlight={[60, 62, 64, 65, 67]} labels="all" className="mt-3 max-w-sm" />
        </Figure>
        <Callout kind="tip" title="Posición de do">
          Coloca el pulgar derecho en do4 y un dedo en cada tecla blanca hasta sol. La mano izquierda hace lo
          mismo con el meñique (5) en do3 y el pulgar (1) en sol3. Con esta posición puedes tocar ya cientos
          de melodías sencillas.
        </Callout>
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>El mismo ejercicio con la mano izquierda: 5-4-3-2-1-2-3-4-5.</span>
              <PlayButton events={[48, 50, 52, 53, 55, 53, 52, 50, 48].map((m, i) => ({ midis: [m], beats: i === 8 ? 4 : 1 }))} bpm={90} beatsPerBar={4} metronome size="sm" />
            </span>
          }
        >
          <Score clef="bass" time="4/4" measures={["C3/q, D3, E3, F3", "G3/q, F3, E3, D3", "C3/w"]} labels={["5", "4", "3", "2", "1", "2", "3", "4", "5"]} labelPosition="above" width={560} endBar="end" />
        </Figure>
      </Section>

      <Section title="Paso del pulgar">
        <P>
          Para tocar más de cinco notas seguidas el pulgar <strong>pasa por debajo</strong> de la mano. En la
          escala de Do mayor con la derecha la digitación es <strong>1-2-3 · 1-2-3-4-5</strong>: después del
          mi (dedo 3) el pulgar se desliza por debajo hasta el fa. Al bajar, el dedo 3 pasa por encima del
          pulgar.
        </P>
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>Escala de Do mayor, mano derecha, con la digitación estándar.</span>
              <PlayButton events={[60, 62, 64, 65, 67, 69, 71, 72].map((m) => ({ midis: [m], beats: 0.5 }))} bpm={90} size="sm" />
            </span>
          }
        >
          <Score time="4/4" measures={["C4/8, D4, E4, F4, G4, A4, B4, C5"]} labels={["1", "2", "3", "1", "2", "3", "4", "5"]} labelPosition="above" width={520} />
        </Figure>
      </Section>

      <Section title="Leer a dos manos">
        <P>
          En el gran pentagrama las notas que están <strong>alineadas verticalmente</strong> suenan a la vez.
          Lee de arriba abajo en cada pulso, no una mano y luego la otra. Al principio:
        </P>
        <ol className="list-decimal pl-5 space-y-2 text-ink leading-relaxed">
          <li>Estudia cada mano por separado hasta que salga sin pensar.</li>
          <li>Junta las manos <strong>muy despacio</strong>, contando en voz alta.</li>
          <li>Trabaja por trozos pequeños (uno o dos compases) y repítelos.</li>
          <li>Sube el tempo poco a poco, solo cuando no haya errores.</li>
        </ol>
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>Melodía en la derecha con acordes largos en la izquierda: el primer paso hacia tocar a dos manos.</span>
              <PlayButton
                events={[
                  { midis: [64, 48, 55], beats: 1 },
                  { midis: [64], beats: 1 },
                  { midis: [65], beats: 1 },
                  { midis: [67], beats: 1 },
                  { midis: [67, 47, 55], beats: 1 },
                  { midis: [65], beats: 1 },
                  { midis: [64], beats: 1 },
                  { midis: [62], beats: 1 },
                  { midis: [60, 48, 55], beats: 1 },
                  { midis: [60], beats: 1 },
                  { midis: [62], beats: 1 },
                  { midis: [64], beats: 1 },
                  { midis: [64, 47, 55], beats: 1.5 },
                  { midis: [62], beats: 0.5 },
                  { midis: [62, 48, 55], beats: 2 },
                ]}
                bpm={100}
                size="sm"
              />
            </span>
          }
        >
          <Score
            time="4/4"
            measures={["E4/q, E4, F4, G4", "G4/q, F4, E4, D4", "C4/q, C4, D4, E4", "E4/q., D4/8, D4/h"]}
            bassMeasures={["(C3 G3)/w", "(B2 G3)/w", "(C3 G3)/w", "(B2 G3)/h, (C3 G3)/h"]}
            width={680}
            endBar="end"
          />
        </Figure>
      </Section>

      <Section title="El pedal">
        <P>
          El pedal derecho (<Glyph name="keyboardPedalPed" inline size={22} />, de resonancia) levanta los
          apagadores: las notas siguen sonando aunque sueltes las teclas. Se pisa <em>después</em> de tocar
          la nota o acorde y se cambia (soltar y volver a pisar rápidamente) cada vez que cambia la armonía
          para que no se mezclen sonidos. El asterisco <Glyph name="keyboardPedalUp" inline size={22} /> indica
          soltarlo.
        </P>
        <Callout kind="warn">
          Al principio practica sin pedal. El pedal disimula errores y hace más difícil escuchar si tocas
          realmente ligado.
        </Callout>
      </Section>

      <Section title="Una rutina de estudio">
        <div className="grid gap-3">
          {[
            ["5 min · Calentar", "Ejercicio de cinco dedos y escala de Do mayor, manos separadas, con metrónomo lento."],
            ["10 min · Lectura", "Un ejercicio de la sección Práctica: notas, ritmo o solfeo. Poco y a diario vale más que mucho un solo día."],
            ["15 min · Repertorio", "Una pieza de tu biblioteca de partituras: trozos cortos, despacio, manos separadas y luego juntas."],
            ["2 min · Repaso", "Toca de principio a fin algo que ya domines. Termina disfrutando."],
          ].map(([t, d]) => (
            <div key={t} className="card p-4">
              <span className="block font-semibold">{t}</span>
              <span className="block text-sm text-ink-2 mt-0.5">{d}</span>
            </div>
          ))}
        </div>
      </Section>
    </LessonLayout>
  );
}
