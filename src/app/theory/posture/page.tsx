import Link from "next/link";
import { LessonLayout, Section, P, Figure } from "@/components/lesson/lesson-layout";
import { Callout } from "@/components/lesson/callout";
import { Score } from "@/components/notation/score";
import { GlyphIcon } from "@/components/notation/glyph-icon";
import { PianoKeyboard } from "@/components/notation/piano-keyboard";
import { PlayButton } from "@/components/audio/play-button";
import {
  SeatedPostureFigure,
  SEATED_POINTS,
  BenchHeightFigure,
  KeyboardTopFigure,
  TOP_POINTS,
  HandArchFigure,
  HAND_POINTS,
  HandTopFigure,
  WristFigure,
  type FigurePoint,
} from "@/components/lesson/posture-figures";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Postura al piano: cómo sentarse y colocar la mano",
  description:
    "Cómo sentarse al piano paso a paso: altura de la banqueta, distancia, espalda, muñeca y el arco de la mano, con ilustraciones, ejercicios de relajación y los errores más comunes.",
  path: "/theory/posture",
  keywords: [
    "postura al piano",
    "cómo sentarse al piano",
    "altura de la banqueta del piano",
    "posición de la mano en el piano",
    "posición de la muñeca al tocar el piano",
    "tocar el piano sin tensión",
    "ejercicios de relajación para pianistas",
  ],
  type: "article",
});

/** Lista que explica los números del dibujo de al lado. */
function Legend({ points }: { points: FigurePoint[] }) {
  return (
    <ol className="grid sm:grid-cols-2 gap-3">
      {points.map((p) => (
        <li key={p.n} className="card p-4 flex gap-3">
          <span className="shrink-0 w-7 h-7 rounded-full bg-accent text-bg text-sm font-bold flex items-center justify-center">
            {p.n}
          </span>
          <span className="text-sm">
            <span className="block font-semibold">{p.title}</span>
            <span className="block text-ink-2 mt-0.5 leading-relaxed">{p.text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Una de las tres viñetas de una comparación (mal / bien / mal). */
function Compare({
  title,
  text,
  good = false,
  children,
}: {
  title: string;
  text: string;
  good?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className={good ? "card-pastel bg-mint p-3" : "card p-3"}>
      {children}
      <span className="block text-sm font-semibold mt-2">{title}</span>
      <span className="block text-xs text-ink-2 mt-0.5 leading-relaxed">{text}</span>
    </li>
  );
}

function Exercise({
  n,
  title,
  meta,
  steps,
  children,
}: {
  n: number;
  title: string;
  meta: string;
  steps: string[];
  children?: React.ReactNode;
}) {
  return (
    <li className="card p-5 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold">
          {n}. {title}
        </h3>
        <span className="text-xs text-ink-2 whitespace-nowrap">{meta}</span>
      </div>
      <ol className="list-decimal pl-5 space-y-1.5 text-sm text-ink-2 leading-relaxed">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {children}
    </li>
  );
}

/** Negra y silencio alternados: el gesto de caer y levantar la muñeca. */
const dropEvents = [
  { midis: [60], beats: 1 },
  { midis: [], beats: 1 },
  { midis: [62], beats: 1 },
  { midis: [], beats: 1 },
  { midis: [64], beats: 1 },
  { midis: [], beats: 1 },
  { midis: [62], beats: 1 },
  { midis: [], beats: 1 },
];

const repeatedEvents = Array.from({ length: 8 }, () => ({ midis: [60], beats: 1 }));

const heldEvents = [
  { midis: [60, 62, 67], beats: 1 },
  { midis: [60, 64, 67], beats: 1 },
  { midis: [60, 65, 67], beats: 1 },
  { midis: [60, 64, 67], beats: 1 },
  { midis: [60, 62, 67], beats: 4 },
];

const TENSION = [
  ["Hombros subidos", "Suéltalos con una respiración larga antes de cada línea. Suben solos cuando la banqueta está baja."],
  ["Pulgar tieso o colgando", "Debe quedar suelto y cerca de su tecla, tocando con el lateral de la punta."],
  ["Meñique levantado en el aire", "Los dedos que no tocan descansan sobre sus teclas, sin apretar."],
  ["Muñeca bloqueada", "Si al terminar una nota la muñeca no puede moverse arriba y abajo, estás sujetando de más."],
  ["Aguantar la respiración", "Cuenta en voz alta mientras tocas: es imposible hacerlo y seguir apretando la mandíbula."],
  ["Dedos estirados y planos", "Vuelve al arco: nudillos altos y la yema sobre la tecla."],
];

const MISTAKES = [
  ["Sentarse demasiado cerca", "Los codos se quedan sin sitio y acaban pegados al cuerpo. Atrasa la banqueta hasta que los nudillos rocen el atril con los brazos estirados."],
  ["Sentarse hasta el fondo", "La cadera se bloquea y la espalda se curva. Ocupa solo la mitad delantera."],
  ["Apretar la tecla ya pulsada", "Una vez abajo, la tecla no puede sonar más fuerte. Suelta el peso en cuanto la nota suena."],
  ["Bajar la cabeza para mirar las manos", "Mira con los ojos, no con el cuello. Y aprovecha para ir mirando cada vez menos el teclado."],
  ["Subir el volumen con los dedos", "El sonido fuerte sale del brazo entero, no de dedos que golpean más rápido."],
  ["Estudiar una hora seguida", "A partir de veinte minutos la tensión se acumula sin que te des cuenta. Levántate y estira."],
];

const CHECKLIST = [
  "Banqueta centrada frente al do central y a un brazo de distancia.",
  "Sentado en la mitad delantera, pies planos en el suelo.",
  "Antebrazos horizontales: si no lo están, ajusta la altura antes de tocar.",
  "Hombros abajo y una respiración larga.",
  "Manos en forma de arco sobre las teclas, muñecas alineadas.",
];

export default function Page() {
  return (
    <LessonLayout slug="postura">
      <Section title="Por qué esto va primero">
        <P>
          La postura no es una formalidad: decide cuánta fuerza necesitas para cada nota. Bien sentado, el
          sonido sale del <strong>peso del brazo</strong> y los dedos solo lo dirigen; mal sentado, cada nota
          hay que empujarla, y en veinte minutos duele el antebrazo. Buena parte de lo que parece falta de
          técnica —dedos que se traban, sonido duro, cansancio a la tercera página— se arregla antes con la
          banqueta que con más horas de estudio.
        </P>
        <P>
          Son cinco minutos de colocación y no hay que volver a pensarlo. Lo difícil es lo contrario:
          corregir dentro de un año una mano que ya se ha acostumbrado a tocar hundida.
        </P>
        <Callout kind="warn" title="Si duele, para">
          Tocar no debería doler nunca. Un pinchazo en la muñeca, el antebrazo, el cuello o los hombros
          significa que algo está mal colocado, no que estés trabajando duro. Para, afloja, revisa la altura y
          la muñeca, y vuelve más despacio. Si el dolor persiste o reaparece, consúltalo con un profesor y con
          un médico.
        </Callout>
      </Section>

      <Section title="Cómo sentarse">
        <P>
          De perfil, la postura correcta se reconoce por una línea: la del antebrazo, que sale del codo y
          llega a las teclas sin subir ni bajar. Todo lo demás —altura, distancia, espalda— existe para que
          esa línea quede horizontal sin esfuerzo.
        </P>
        <Figure caption="La postura de perfil. Los números se explican debajo.">
          <SeatedPostureFigure className="max-w-xl mx-auto" />
        </Figure>
        <Legend points={SEATED_POINTS} />
      </Section>

      <Section title="La altura de la banqueta">
        <P>
          Es el ajuste que más cambia y el que casi nadie hace. La altura buena es la que deja el{" "}
          <strong>antebrazo horizontal</strong> con la mano sobre las teclas: ni el codo por debajo del
          teclado ni los hombros encogidos hacia arriba.
        </P>
        <ul className="grid grid-cols-3 gap-2 sm:gap-3">
          <Compare title="Demasiado baja" text="El antebrazo sube hacia las teclas, la muñeca se hunde y el sonido se vuelve duro.">
            <BenchHeightFigure variant="low" />
          </Compare>
          <Compare good title="Correcta" text="Codo a la altura de las teclas, antebrazo horizontal, hombros sueltos." >
            <BenchHeightFigure variant="ok" />
          </Compare>
          <Compare title="Demasiado alta" text="El antebrazo cae hacia las teclas y los hombros se levantan para compensar.">
            <BenchHeightFigure variant="high" />
          </Compare>
        </ul>
        <Callout kind="tip" title="Cómo comprobarlo en diez segundos">
          Apoya la mano en las teclas sin tocar y mira tu codo de reojo: debe quedar a la altura de las teclas
          blancas o un dedo por encima, nunca por debajo. Si no tienes banqueta regulable, sube con un cojín
          firme —no blando, o te hundirás al tocar— y, si eres bajo o estás enseñando a un niño, pon una caja
          o un reposapiés para que los pies no queden colgando.
        </Callout>
      </Section>

      <Section title="La distancia y el centro">
        <P>
          Desde arriba se ven las otras dos referencias: estar <strong>centrado</strong> y estar{" "}
          <strong>lo bastante lejos</strong>. Casi todo el mundo se sienta demasiado cerca, y los codos se
          quedan sin sitio para moverse hacia delante.
        </P>
        <Figure caption="Vista desde arriba: el mismo eje para el teclado, la banqueta y el cuerpo.">
          <KeyboardTopFigure className="max-w-lg mx-auto" />
        </Figure>
        <Legend points={TOP_POINTS} />
        <Figure caption="El centro del teclado cae junto al do central: ese es el punto al que te enfrentas.">
          <PianoKeyboard from={48} to={72} highlight={[60]} labels="c" sound={false} className="max-w-md mx-auto" />
        </Figure>
      </Section>

      <Section title="La posición de la mano">
        <P>
          Deja el brazo colgando al costado, del todo relajado, y mira la mano: los dedos quedan{" "}
          <strong>algo curvados y separados</strong>, y el pulgar mira hacia dentro. Esa forma, tal cual, es la
          que hay que subir al teclado. No hay que fabricar nada: solo no deshacerla al apoyar.
        </P>
        <Figure caption="La mano de perfil sobre las teclas. Debajo del arco cabe una pelota pequeña.">
          <HandArchFigure className="max-w-lg mx-auto" />
        </Figure>
        <Legend points={HAND_POINTS} />

        <div className="grid md:grid-cols-2 gap-3 items-center">
          <Figure caption="Los dedos se numeran igual en las dos manos: el pulgar es siempre el 1.">
            <HandTopFigure className="max-w-[13rem] mx-auto" />
          </Figure>
          <div className="space-y-3">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="card w-12 h-12 flex items-center justify-center">
                  <GlyphIcon name={`fingering${n}`} size={26} label={`dedo ${n}`} />
                </div>
              ))}
            </div>
            <p className="text-sm text-ink-2 leading-relaxed">
              Son los números que verás sobre las notas en las partituras. El 4 y el 5 son los dedos débiles: no
              se fortalecen apretando, sino tocando despacio y dejando que el brazo les pase el peso. De la
              digitación —qué dedo toca cada nota, y por qué— se ocupa la lección de{" "}
              <Link href="/theory/piano" className="underline underline-offset-2">
                técnica básica del piano
              </Link>
              .
            </p>
          </div>
        </div>

        <h3 className="text-base font-semibold pt-2">La muñeca</h3>
        <P>
          La muñeca es la bisagra entre el brazo y los dedos: si está bloqueada, el peso del brazo no llega a
          la tecla. En reposo tiene que quedar a la altura del dorso de la mano.
        </P>
        <ul className="grid grid-cols-3 gap-2 sm:gap-3">
          <Compare title="Hundida" text="Por debajo de los nudillos. El arco se derrumba y los dedos empujan solos.">
            <WristFigure variant="low" />
          </Compare>
          <Compare good title="Alineada" text="Antebrazo, muñeca y nudillos en una línea. Así pasa el peso.">
            <WristFigure variant="ok" />
          </Compare>
          <Compare title="Levantada" text="Por encima de los nudillos. Bloquea el antebrazo y cansa enseguida.">
            <WristFigure variant="high" />
          </Compare>
        </ul>
        <Callout kind="tip" title="Detalles que parecen menores">
          Uñas cortas: con uña larga es imposible tocar con la yema y el dedo se estira. Anillos y relojes
          fuera. Y el pulgar toca con el <em>lateral</em> de la punta, nunca con la articulación de abajo.
        </Callout>
      </Section>

      <Section title="Ejercicios">
        <P>
          Cinco minutos al principio de cada sesión, antes del repertorio. Los tres primeros no necesitan leer
          nada: se trata de notar el peso y la soltura, no de tocar rápido.
        </P>
        <ol className="grid gap-3">
          <Exercise
            n={1}
            title="El peso del brazo"
            meta="2 min · sin partitura"
            steps={[
              "Deja el brazo colgando al costado y sacúdelo hasta notarlo pesado y caliente.",
              "Súbelo con la mano ya formada, como si sostuvieras una pelota pequeña.",
              "Déjalo caer sobre el dedo 3 en cualquier tecla blanca. El sonido lo hace la caída, no un empujón de los dedos.",
              "Aguanta la tecla abajo un segundo sin apretar nada: ya está en el fondo, sostenerla no cuesta fuerza.",
              "Ocho veces con cada mano, alternando.",
            ]}
          />
          <Exercise
            n={2}
            title="Caída y rebote"
            meta="3 min · con el metrónomo a 60"
            steps={[
              "En el pulso, la muñeca cae y el dedo toca la nota.",
              "En el silencio, la muñeca sube y la mano se suelta en el aire un instante.",
              "Ni un solo compás con la mano agarrotada: si notas tensión, para y sacude el brazo.",
            ]}
          >
            <Figure
              caption={
                <span className="flex flex-wrap items-center gap-3">
                  <span>Una nota por pulso, con el silencio para soltar. Dedo 3 en las dos manos.</span>
                  <PlayButton events={dropEvents} bpm={60} beatsPerBar={4} metronome size="sm" />
                </span>
              }
            >
              <Score
                time="4/4"
                measures={["C4/q, B4/q/r, D4/q, B4/q/r", "E4/q, B4/q/r, D4/q, B4/q/r"]}
                labels={["3", "", "3", "", "3", "", "3", ""]}
                labelPosition="above"
                width={520}
                endBar="end"
              />
            </Figure>
          </Exercise>
          <Exercise
            n={3}
            title="Notas repetidas, muñeca suelta"
            meta="3 min · a 60, subiendo poco a poco"
            steps={[
              "Ocho negras seguidas en la misma tecla con el dedo 3, sin levantar la mano del teclado.",
              "La muñeca hace un movimiento pequeño arriba y abajo en cada nota; el dedo no golpea.",
              "Repite con el 2 y con el 4. Con el 4 el sonido saldrá más flojo: no lo compenses apretando, baja el tempo.",
            ]}
          >
            <Figure
              caption={
                <span className="flex flex-wrap items-center gap-3">
                  <span>Ocho negras en do4. Escucha que todas suenen igual de fuertes.</span>
                  <PlayButton events={repeatedEvents} bpm={60} beatsPerBar={4} metronome size="sm" />
                </span>
              }
            >
              <Score
                time="4/4"
                measures={["C4/q, C4, C4, C4", "C4/q, C4, C4, C4"]}
                labels={["3", "3", "3", "3", "2", "2", "2", "2"]}
                labelPosition="above"
                width={520}
                endBar="end"
              />
            </Figure>
          </Exercise>
          <Exercise
            n={4}
            title="Dedos quietos, dedos que tocan"
            meta="4 min · muy despacio"
            steps={[
              "Mano derecha en posición de do: pulgar en do4 y un dedo en cada tecla blanca hasta sol.",
              "Mantén pulsados el 1 (do) y el 5 (sol) durante todo el ejercicio, sin apretar.",
              "Toca re, mi, fa y vuelve, con los dedos 2, 3 y 4, mientras los otros dos siguen abajo.",
              "Vigila el arco: los nudillos no se hunden y la muñeca sigue a la altura del dorso.",
              "Luego lo mismo con la izquierda, una octava por debajo.",
            ]}
          >
            <Figure
              caption={
                <span className="flex flex-wrap items-center gap-3">
                  <span>Do y sol sostenidos; el 2, el 3 y el 4 se mueven por debajo del arco.</span>
                  <PlayButton events={heldEvents} bpm={60} beatsPerBar={4} size="sm" />
                </span>
              }
            >
              <Score
                time="4/4"
                measures={["(C4 D4 G4)/q, (C4 E4 G4), (C4 F4 G4), (C4 E4 G4)", "(C4 D4 G4)/w"]}
                labels={["2", "3", "4", "3", "2"]}
                labelPosition="above"
                width={520}
                endBar="end"
              />
              <PianoKeyboard from={60} to={67} highlight={[60, 67]} highlightAlt={[62, 64, 65]} labels="all" className="mt-3 max-w-sm mx-auto" />
            </Figure>
          </Exercise>
          <Exercise
            n={5}
            title="El puente de los nudillos"
            meta="1 min · sin sonido"
            steps={[
              "Baja las cinco teclas a la vez, muy despacio, hasta el fondo y sin que suenen.",
              "Aguanta diez segundos mirando los nudillos: tienen que seguir siendo el punto más alto de la mano.",
              "Si alguno se hunde hacia dentro, suelta y vuelve a colocar la mano. Es el fallo más común del dedo 1 y del 5.",
            ]}
          />
          <Exercise
            n={6}
            title="Pausa y estiramiento"
            meta="1 min cada 20 min"
            steps={[
              "Levántate de la banqueta; no sirve estirar sentado.",
              "Deja los brazos colgando y sacúdelos como si escurrieras agua de las manos.",
              "Abre y cierra las manos despacio cinco veces, y gira los hombros hacia atrás otras cinco.",
              "Vuelve a sentarte y recoloca la postura desde cero, no donde la dejaste.",
            ]}
          />
        </ol>
      </Section>

      <Section title="Señales de tensión">
        <P>
          La tensión no avisa: se instala mientras estás concentrado en las notas. Estas seis señales son las
          que puedes detectar tú mismo sin dejar de tocar.
        </P>
        <ul className="grid sm:grid-cols-2 gap-3">
          {TENSION.map(([t, d]) => (
            <li key={t} className="card p-4 text-sm">
              <span className="block font-semibold">{t}</span>
              <span className="block text-ink-2 mt-0.5 leading-relaxed">{d}</span>
            </li>
          ))}
        </ul>
        <Callout kind="info" title="Grábate treinta segundos">
          Colocado desde dentro todo parece correcto. Pon el móvil de perfil, a la altura del teclado, y toca
          medio minuto: la banqueta baja, los hombros subidos y la muñeca hundida se ven en el vídeo a la
          primera, y no hay otra forma de verlos mientras tocas.
        </Callout>
      </Section>

      <Section title="Errores frecuentes">
        <ul className="grid sm:grid-cols-2 gap-3">
          {MISTAKES.map(([t, d]) => (
            <li key={t} className="card p-4 text-sm">
              <span className="block font-semibold">{t}</span>
              <span className="block text-ink-2 mt-0.5 leading-relaxed">{d}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Treinta segundos antes de tocar">
        <P>
          Repasa esto cada vez que te sientes, hasta que deje de hacer falta pensarlo. Es lo único de la
          lección que hay que recordar a diario.
        </P>
        <ol className="grid gap-2">
          {CHECKLIST.map((item, i) => (
            <li key={item} className="card p-4 flex gap-3 text-sm items-center">
              <span className="shrink-0 w-7 h-7 rounded-full bg-accent text-bg font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </Section>
    </LessonLayout>
  );
}
