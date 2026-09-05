import { LessonLayout, Section, P, Figure } from "@/components/lesson/lesson-layout";
import { Callout } from "@/components/lesson/callout";
import { Score } from "@/components/notation/score";
import { SymbolCatalog } from "@/components/notation/symbol-catalog";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Símbolos de la partitura y su significado",
  description:
    "Catálogo con buscador de los signos de la partitura: dinámicas, articulaciones, adornos, repeticiones, octavas y pedal, dibujados con las fuentes SMuFL originales.",
  path: "/theory/symbols",
  keywords: ["símbolos musicales", "signos de la partitura", "dinámicas musicales", "articulaciones", "adornos musicales"],
  type: "article",
});

export default function Page() {
  return (
    <LessonLayout slug="simbolos">
      <Section title="Más allá de las notas">
        <P>
          Una partitura no solo dice <em>qué</em> notas tocar y <em>cuándo</em>: también indica{" "}
          <strong>cómo</strong> tocarlas. Las <strong>dinámicas</strong> marcan la intensidad, las{" "}
          <strong>articulaciones</strong> el modo de atacar y separar cada nota, los <strong>adornos</strong>{" "}
          añaden notas decorativas y las <strong>marcas de repetición</strong> indican saltos. Todos los
          glifos de esta lección son los originales del estándar SMuFL, tal y como aparecen en las partituras
          impresas.
        </P>
        <Figure caption="Orden habitual al principio del pentagrama: clave, armadura y compás. Después vienen las notas con sus indicaciones.">
          <Score keySignature="D" time="3/4" measures={["D4/q, F#4, A4", "D5/h."]} width={420} endBar="end" />
        </Figure>
        <Callout kind="tip" title="Cómo estudiar esta lección">
          No intentes memorizarlo todo de golpe. Lee las categorías, y cuando encuentres un símbolo nuevo en
          una partitura vuelve aquí y búscalo. Con la práctica de flashcards de la sección Práctica los
          fijarás sin esfuerzo.
        </Callout>
      </Section>

      <SymbolCatalog />
    </LessonLayout>
  );
}
