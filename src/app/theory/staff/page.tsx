import { LessonLayout, Section, P, Figure } from "@/components/lesson/lesson-layout";
import { Callout } from "@/components/lesson/callout";
import { Score } from "@/components/notation/score";
import { Glyph } from "@/components/notation/glyph";
import { PlayButton } from "@/components/audio/play-button";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "El pentagrama: líneas, espacios y notas",
  description:
    "Qué es el pentagrama, cómo se cuentan sus cinco líneas y sus cuatro espacios, dónde va cada nota y para qué sirven las líneas adicionales.",
  path: "/theory/staff",
  keywords: ["pentagrama", "qué es el pentagrama", "líneas y espacios del pentagrama", "líneas adicionales"],
  type: "article",
});

const scaleEvents = [60, 62, 64, 65, 67, 69, 71, 72].map((m) => ({ midis: [m], beats: 1 }));

export default function Page() {
  return (
    <LessonLayout slug="pentagrama">
      <Section title="Cinco líneas y cuatro espacios">
        <P>
          La música se escribe sobre el <strong>pentagrama</strong>: cinco líneas horizontales paralelas que
          forman cuatro espacios entre ellas. Tanto las líneas como los espacios se cuentan{" "}
          <strong>de abajo hacia arriba</strong>: la primera línea es la más grave y la quinta, la más aguda.
        </P>
        <Figure caption="Notas sobre las cinco líneas (con clave de sol, que veremos en la siguiente lección).">
          <Score
            measures={["E4/w, G4, B4, D5, F5"]}
            labels={["1.ª línea", "2.ª línea", "3.ª línea", "4.ª línea", "5.ª línea"]}
            width={520}
          />
        </Figure>
        <Figure caption="Notas en los cuatro espacios.">
          <Score
            measures={["F4/w, A4, C5, E5"]}
            labels={["1.er espacio", "2.º espacio", "3.er espacio", "4.º espacio"]}
            width={520}
          />
        </Figure>
        <P>
          Cada línea y cada espacio corresponde a una nota distinta. Una nota escrita <em>sobre</em> una
          línea tiene la línea atravesando el centro de su cabeza; una nota <em>en</em> un espacio queda
          entre dos líneas sin tocarlas.
        </P>
      </Section>

      <Section title="Arriba es agudo, abajo es grave">
        <P>
          La altura en el pentagrama representa la altura del sonido. Cuanto más arriba está la nota, más
          aguda suena; cuanto más abajo, más grave. Si las notas suben de posición en posición (línea,
          espacio, línea, espacio…) recorren la escala nota a nota.
        </P>
        <Figure
          caption={
            <span className="flex flex-wrap items-center gap-3">
              <span>Escala de do ascendente: cada nota ocupa la posición inmediatamente superior.</span>
              <PlayButton events={scaleEvents} bpm={100} size="sm" />
            </span>
          }
        >
          <Score measures={["C4/q, D4, E4, F4", "G4/q, A4, B4, C5"]} time="4/4" width={520} endBar="end" />
        </Figure>
      </Section>

      <Section title="Líneas adicionales">
        <P>
          Cuando una nota es demasiado aguda o grave para caber en el pentagrama, se dibujan pequeñas{" "}
          <strong>líneas adicionales</strong> <Glyph name="legerLine" inline size={22} /> por encima o por
          debajo. Funcionan como una extensión del pentagrama: siguen alternando líneas y espacios.
        </P>
        <Figure caption="Notas por debajo (la3, si3, do4) y por encima (sol5, la5, si5, do6) del pentagrama en clave de sol.">
          <Score
            measures={["A3/w, B3, C4, G5, A5, B5, C6"]}
            labels={["la3", "si3", "do4", "sol5", "la5", "si5", "do6"]}
            width={560}
          />
        </Figure>
        <Callout kind="tip">
          El <strong>do central</strong> (do4) se escribe con una línea adicional bajo el pentagrama en
          clave de sol y con una línea adicional sobre el pentagrama en clave de fa. Es la nota «puente»
          entre las dos manos del piano.
        </Callout>
      </Section>

      <Section title="Cómo leer por posiciones">
        <P>
          Al principio no hace falta memorizar todas las notas. Basta con conocer unas pocas notas de
          referencia y contar posiciones: cada paso de línea a espacio (o de espacio a línea) es la nota
          siguiente del alfabeto musical <em>do, re, mi, fa, sol, la, si</em>, que se repite sin fin.
        </P>
        <Figure caption="Desde el do4 (línea adicional) subiendo de posición en posición.">
          <Score
            measures={["C4/q, D4, E4, F4, G4, A4, B4, C5"]}
            labels={["do", "re", "mi", "fa", "sol", "la", "si", "do"]}
            time="8/4"
            width={560}
          />
        </Figure>
        <Callout kind="info" title="Resumen">
          <ul className="list-disc pl-4 space-y-1">
            <li>5 líneas y 4 espacios, numerados de abajo arriba.</li>
            <li>Más arriba = más agudo; más abajo = más grave.</li>
            <li>Las líneas adicionales amplían el pentagrama.</li>
            <li>Cada posición consecutiva es la siguiente nota de la escala.</li>
          </ul>
        </Callout>
      </Section>
    </LessonLayout>
  );
}
