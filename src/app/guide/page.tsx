import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { GlyphIcon } from "@/components/notation/glyph-icon";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import { ALL_LESSONS } from "@/data/lessons";
import { EXERCISES } from "@/data/exercises";
import { exercisePath, lessonPath } from "@/lib/routes";
import { courseJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Cómo leer partituras: guía completa para empezar desde cero",
  description:
    "Guía para aprender a leer partituras desde cero: el pentagrama, las claves, las figuras, el compás, la armadura y los símbolos, en el orden en que conviene aprenderlos y con un plan de práctica de cuatro semanas.",
  path: "/guide",
  type: "article",
  keywords: [
    "cómo leer partituras",
    "aprender a leer partituras desde cero",
    "leer música",
    "curso de solfeo gratis",
    "lenguaje musical para principiantes",
    "aprender piano desde cero",
  ],
});

const TOC = [
  { id: "que-es", label: "Qué es una partitura" },
  { id: "pentagrama", label: "El pentagrama" },
  { id: "claves", label: "Las claves" },
  { id: "figuras", label: "Cuánto dura cada nota" },
  { id: "compas", label: "El compás" },
  { id: "armadura", label: "La armadura" },
  { id: "simbolos", label: "Los símbolos de expresión" },
  { id: "teclado", label: "Del papel a las teclas" },
  { id: "plan", label: "Plan de cuatro semanas" },
  { id: "errores", label: "Errores frecuentes" },
];

const totalMinutes = ALL_LESSONS.reduce((sum, lesson) => sum + lesson.minutes, 0);

/**
 * Página pilar: el texto largo que explica el tema entero y desde el que salen
 * enlaces a cada lección. Es la que se posiciona para la búsqueda genérica
 * («cómo leer partituras»); las lecciones cubren cada subtema por separado.
 */
export default function GuidePage() {
  return (
    <article className="prose-music">
      <JsonLd
        data={courseJsonLd({
          name: "Aprende a leer partituras y a tocar el piano",
          description:
            "Itinerario completo de lenguaje musical en español: pentagrama, claves, notas, figuras, compases, armaduras, símbolos y técnica de piano, con ejercicios interactivos.",
          path: "/guide",
          totalMinutes,
          sections: ALL_LESSONS.map((lesson) => ({
            name: lesson.title,
            description: lesson.summary,
            path: lessonPath(lesson.slug),
          })),
        })}
      />
      <Breadcrumbs items={[{ name: "Guía", path: "/guide" }]} />

      <PageHeader
        eyebrow="Guía"
        title="Cómo leer partituras desde cero"
        intro="Una partitura no es un idioma difícil: son cinco líneas, siete nombres de nota y media docena de figuras. Lo que la hace parecer imposible es intentar aprenderlo todo a la vez. Esta guía la desmonta en el orden en que conviene aprenderla, con enlaces a la lección y al ejercicio de cada parte."
      />

      <nav aria-label="Índice de la guía" className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-3">En esta guía</h2>
        <ol className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          {TOC.map((item, i) => (
            <li key={item.id}>
              <a href={`#${item.id}`} className="text-ink-2 hover:text-accent transition-colors">
                <span className="text-ink-3 tabular-nums mr-1.5">{i + 1}.</span>
                {item.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 space-y-10">
        <section id="que-es" className="scroll-mt-20 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">1. Qué es exactamente una partitura</h2>
          <p>
            Una partitura responde a dos preguntas para cada sonido: <strong>qué nota</strong> y{" "}
            <strong>cuánto dura</strong>. La altura se dibuja en el eje vertical —cuanto más arriba
            está la nota, más aguda suena— y la duración se codifica en la forma de la propia nota:
            si tiene la cabeza rellena o hueca, si lleva plica, si lleva corchetes. Todo lo demás
            que aparece escrito (matices, articulaciones, pedal) son instrucciones de interpretación
            que se añaden encima de esas dos.
          </p>
          <p>
            Por eso el orden de aprendizaje no es arbitrario: primero se aprende a situar la altura,
            después a medir la duración, y solo al final se añade la expresión.
          </p>
        </section>

        <section id="pentagrama" className="scroll-mt-20 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">2. El pentagrama: dónde vive cada nota</h2>
          <p>
            El pentagrama son cinco líneas y los cuatro espacios que quedan entre ellas: nueve
            posiciones, que se cuentan siempre <strong>de abajo arriba</strong>. Cada posición es una
            nota, y al subir de una a la siguiente se avanza un nombre en la serie do, re, mi, fa,
            sol, la, si, que vuelve a empezar indefinidamente.
          </p>
          <p>
            Cuando una nota se sale por arriba o por abajo se le dibuja un trocito de línea propio,
            la <Link href="/glossary/linea-adicional">línea adicional</Link>. No es una excepción ni
            una regla nueva: es el mismo pentagrama, prolongado.
          </p>
          <LessonLink slug="pentagrama" />
        </section>

        <section id="claves" className="scroll-mt-20 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">3. Las claves: la señal que da nombre a las líneas</h2>
          <p>
            Las nueve posiciones del pentagrama no significan nada por sí solas. Lo que les pone
            nombre es la clave, el signo del principio. La{" "}
            <Link href="/glossary/clave">clave de sol</Link> rodea con su espiral la segunda línea y
            la declara sol4; a partir de ahí, todo lo demás se deduce. La clave de fa marca con sus
            dos puntos la cuarta línea y la declara fa3.
          </p>
          <p>
            Al piano se usan las dos a la vez, unidas por una llave: la de sol para la mano derecha
            y la de fa para la izquierda. Es el detalle que más desconcierta al principio, porque{" "}
            <strong>la misma línea significa notas distintas en cada pentagrama</strong>. No hay
            atajo: hay que leer las dos hasta que dejen de pensarse.
          </p>
          <LessonLink slug="claves" />
        </section>

        <section id="figuras" className="scroll-mt-20 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">4. Las figuras: cuánto dura cada nota</h2>
          <p>
            Las duraciones no se miden en segundos, sino unas con respecto a otras, y cada figura
            vale la mitad de la anterior: la <Link href="/glossary/redonda">redonda</Link> vale dos{" "}
            <Link href="/glossary/blanca">blancas</Link>, la blanca dos{" "}
            <Link href="/glossary/negra">negras</Link>, la negra dos{" "}
            <Link href="/glossary/corchea">corcheas</Link>, y así sucesivamente. Solo hay dos
            modificadores que romper esa serie de mitades: el{" "}
            <Link href="/glossary/puntillo">puntillo</Link>, que añade la mitad del valor, y el{" "}
            <Link href="/glossary/tresillo">tresillo</Link>, que mete tres notas donde caben dos.
          </p>
          <p>
            Cada figura tiene además su <Link href="/glossary/silencio">silencio</Link> equivalente:
            el mismo valor, pero sin sonido. Contar los silencios es tan importante como contar las
            notas, y es el error más habitual al empezar.
          </p>
          <LessonLink slug="figuras" />
        </section>

        <section id="compas" className="scroll-mt-20 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">5. El compás: cómo se agrupa el tiempo</h2>
          <p>
            La música tiene un latido regular, el <Link href="/glossary/pulso">pulso</Link>, y ese
            pulso se agrupa en paquetes iguales separados por barras verticales: los compases. Los
            dos números del principio dicen cómo son esos paquetes. El de arriba, cuántos pulsos
            entran; el de abajo, qué figura vale un pulso (4 es la negra, 8 la corchea, 2 la
            blanca).
          </p>
          <p>
            Así, 4/4 son cuatro negras por compás, 3/4 es el vals y 6/8 son seis corcheas agrupadas
            de tres en tres. El primer pulso de cada compás se percibe más fuerte, y ese acento es
            lo que hace que una música suene a vals o a marcha aunque las notas sean las mismas.
          </p>
          <LessonLink slug="compases" />
        </section>

        <section id="armadura" className="scroll-mt-20 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">6. La armadura: la tonalidad de la pieza</h2>
          <p>
            Entre la clave y el compás pueden aparecer varios sostenidos o bemoles. Es la{" "}
            <Link href="/glossary/armadura">armadura</Link>, y funciona como una instrucción
            permanente: «todos los fa de esta pieza son sostenidos», en cualquier octava y hasta el
            final, sin repetir el signo. Escribirlo una vez al principio ahorra centenares de
            alteraciones por el camino.
          </p>
          <p>
            Cada combinación corresponde a una <Link href="/glossary/tonalidad">tonalidad</Link>, y
            el círculo de quintas es el mapa que las ordena: cada paso hacia la derecha añade un
            sostenido, cada paso hacia la izquierda añade un bemol. Reconocer la armadura de un
            vistazo evita tener que pensar cada alteración mientras se toca.
          </p>
          <LessonLink slug="armaduras" />
        </section>

        <section id="simbolos" className="scroll-mt-20 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">7. Los símbolos: cómo hay que tocarlo</h2>
          <p>
            Con la altura y la duración ya se puede tocar una pieza; con los símbolos se puede tocar
            bien. Las <strong>dinámicas</strong> (de <em>pianissimo</em> a <em>fortissimo</em>) dicen
            con qué intensidad; las <strong>articulaciones</strong> (
            <Link href="/glossary/staccato">staccato</Link>,{" "}
            <Link href="/glossary/legato">legato</Link>, acento) dicen cómo se ataca y se separa cada
            nota; las <strong>repeticiones</strong> (barras, segno, coda) dicen en qué orden se
            recorre la partitura, que casi nunca es de izquierda a derecha sin más.
          </p>
          <p>
            No hay que memorizarlos de golpe. Se aprenden según aparecen, y para eso está el{" "}
            <Link href="/symbols">diccionario visual de símbolos</Link>: se busca el signo, se lee
            qué significa y se sigue tocando.
          </p>
          <LessonLink slug="simbolos" />
        </section>

        <section id="teclado" className="scroll-mt-20 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">8. Del papel a las teclas</h2>
          <p>
            Leer y tocar son dos habilidades distintas y conviene practicarlas por separado antes de
            juntarlas. El teclado tiene su propia lógica: las teclas negras van en grupos de dos y de
            tres, y ese dibujo es la referencia para orientarse. El do está siempre a la izquierda
            del grupo de dos negras, en todas las octavas.
          </p>
          <p>
            La <Link href="/glossary/octava">octava</Link> es la distancia entre dos notas del mismo
            nombre: doce <Link href="/glossary/semitono">semitonos</Link>, doce teclas contando
            blancas y negras. Y los dedos se numeran del 1 (pulgar) al 5 (meñique) en las dos manos,
            de modo que un 3 escrito sobre una nota significa el dedo corazón, sea la mano que sea.
          </p>
          <LessonLink slug="piano" />
        </section>

        <section id="plan" className="scroll-mt-20 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">9. Un plan realista de cuatro semanas</h2>
          <p>
            Diez minutos al día rinden mucho más que dos horas el domingo: lo que se está
            construyendo es reconocimiento automático, y eso se consigue con repeticiones separadas
            en el tiempo, no con sesiones largas.
          </p>
          <ol className="space-y-3">
            <WeekItem
              week="Semana 1"
              title="Las notas en clave de sol"
              text="Pentagrama, clave de sol y las notas de las líneas y los espacios. Diez minutos diarios de lectura de notas hasta responder sin contar."
              href={exercisePath("notas")}
              cta="Ejercicio de lectura de notas"
            />
            <WeekItem
              week="Semana 2"
              title="El ritmo, por separado"
              text="Figuras, silencios y compás, sin tocar ninguna nota: solo golpear el pulso y el ritmo con el metrónomo."
              href={exercisePath("ritmo")}
              cta="Ejercicio de ritmo"
            />
            <WeekItem
              week="Semana 3"
              title="La clave de fa y las dos manos"
              text="Añadir la clave de fa y empezar a leer el gran pentagrama completo, llevando cada nota a su tecla."
              href={exercisePath("teclado")}
              cta="Ejercicio de teclado"
            />
            <WeekItem
              week="Semana 4"
              title="Armaduras y símbolos"
              text="Reconocer la tonalidad de un vistazo y los signos de expresión que aparecen en cualquier partitura."
              href={exercisePath("armaduras")}
              cta="Ejercicio de armaduras"
            />
          </ol>
        </section>

        <section id="errores" className="scroll-mt-20 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">10. Cuatro errores que cuesta desaprender</h2>
          <ul className="space-y-3">
            <Mistake title="Escribir el nombre de las notas encima">
              Funciona el primer día y bloquea durante meses: el ojo aprende a leer las letras, no
              las posiciones, y la lectura real no llega a arrancar.
            </Mistake>
            <Mistake title="Contar líneas desde el do central cada vez">
              Es una muleta razonable al principio, pero hay que soltarla pronto. Conviene fijar
              tres o cuatro notas de referencia y deducir el resto desde ellas.
            </Mistake>
            <Mistake title="Saltarse los silencios">
              Un silencio dura exactamente lo que dice su figura. Al ignorarlos el ritmo se
              deshace, y casi siempre es ahí donde una pieza «suena rara» sin saber por qué.
            </Mistake>
            <Mistake title="Practicar siempre la misma pieza">
              Repetir lo que ya sale es agradable, pero no enseña a leer. La lectura mejora leyendo
              material nuevo, aunque sea más fácil.
            </Mistake>
          </ul>
        </section>

        <section className="scroll-mt-20 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Las lecciones, por orden</h2>
          <p>
            El itinerario completo son {ALL_LESSONS.length} lecciones y unos{" "}
            {Math.round(totalMinutes / 60)} horas de lectura, con sus ejercicios.
          </p>
          <ol className="space-y-2">
            {ALL_LESSONS.map((lesson, i) => (
              <li key={lesson.slug}>
                <Link
                  href={lessonPath(lesson.slug)}
                  className="card p-3 pr-4 flex items-center gap-3 hover:bg-surface-2 transition-colors"
                >
                  <span className="w-11 h-11 rounded-full bg-blue flex items-center justify-center shrink-0">
                    <GlyphIcon name={lesson.glyph} size={22} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {i + 1}. {lesson.title}
                    </span>
                    <span className="block text-xs text-ink-3 mt-0.5">{lesson.summary}</span>
                  </span>
                  <span className="text-xs text-ink-3 shrink-0">{lesson.minutes} min</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <section className="card-pastel bg-mint p-6">
          <h2 className="text-xl font-semibold tracking-tight">Y para practicar</h2>
          <p className="mt-2 text-ink-2 leading-relaxed">
            {EXERCISES.length} ejercicios que corrigen solos y guardan tu progreso.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {EXERCISES.map((exercise) => (
              <li key={exercise.id}>
                <Link href={exercisePath(exercise.id)} className="pill text-sm">
                  <GlyphIcon name={exercise.glyph} size={16} />
                  {exercise.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </article>
  );
}

function LessonLink({ slug }: { slug: string }) {
  const lesson = ALL_LESSONS.find((l) => l.slug === slug);
  if (!lesson) return null;
  return (
    <Link
      href={lessonPath(lesson.slug)}
      className="card p-4 flex items-center gap-3 hover:bg-surface-2 transition-colors"
    >
      <span className="w-10 h-10 rounded-full bg-surface-2 grid place-items-center shrink-0">
        <GlyphIcon name={lesson.glyph} size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-ink-3">Lección · {lesson.minutes} min</span>
        <span className="block font-medium">{lesson.title}</span>
      </span>
      <ArrowIcon className="w-5 h-5 text-ink-3" />
    </Link>
  );
}

function WeekItem({
  week,
  title,
  text,
  href,
  cta,
}: {
  week: string;
  title: string;
  text: string;
  href: string;
  cta: string;
}) {
  return (
    <li className="card p-4">
      <p className="text-xs text-ink-3 uppercase tracking-wider">{week}</p>
      <h3 className="font-semibold mt-0.5">{title}</h3>
      <p className="text-sm text-ink-2 mt-1 leading-relaxed">{text}</p>
      <Link href={href} className="inline-block mt-2 text-sm text-accent hover:underline">
        {cta} →
      </Link>
    </li>
  );
}

function Mistake({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="card p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-ink-2 mt-1 leading-relaxed">{children}</p>
    </li>
  );
}
