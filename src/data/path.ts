/**
 * La ruta: en qué orden hacer lo que ya hay en la app.
 *
 * Teoría, práctica y partituras son tres catálogos, y un catálogo solo sirve
 * si ya sabes lo que buscas. Quien empieza de cero no lo sabe, así que aquí
 * están las mismas lecciones, ejercicios y piezas puestos en fila, con el
 * motivo de por qué toca cada uno ahora y no antes.
 *
 * No hay contenido nuevo: cada paso apunta a algo que ya existe. Si se añade
 * una lección o una pieza, se añade también aquí; no hay nada más que
 * mantener sincronizado.
 */

export type PathStepKind = "lesson" | "exercise" | "piece";

export interface PathStep {
  kind: PathStepKind;
  /** Slug de la lección (`lessons.ts`), id del ejercicio (`exercises.ts`) o id de la pieza (`catalog.ts`). */
  ref: string;
  /** Por qué toca ahora. Es lo único que la ruta añade a lo que ya dice cada página. */
  why: string;
}

export interface PathStage {
  id: string;
  title: string;
  /** Qué sabrás hacer al terminar la etapa. */
  goal: string;
  steps: PathStep[];
}

export const PATH: PathStage[] = [
  {
    id: "leer-una-nota",
    title: "1. Leer una nota",
    goal: "Ver una nota en el pentagrama y decir su nombre sin pararte a contar.",
    steps: [
      { kind: "lesson", ref: "pentagrama", why: "Cinco líneas y cuatro espacios. Todo lo demás se apoya en esto." },
      { kind: "lesson", ref: "claves", why: "La clave decide qué nota es cada línea; sin ella el pentagrama no dice nada." },
      { kind: "lesson", ref: "notas", why: "Los nombres, las octavas y dónde cae cada nota en el teclado." },
      { kind: "exercise", ref: "notas", why: "Leer se automatiza repitiendo, no entendiendo. Aquí es donde pasa." },
      { kind: "exercise", ref: "teclado", why: "Del pentagrama a la tecla: el paso que de verdad harás al tocar." },
    ],
  },
  {
    id: "medir-el-tiempo",
    title: "2. Medir el tiempo",
    goal: "Leer un ritmo y tocarlo a tiempo, con metrónomo.",
    steps: [
      { kind: "lesson", ref: "figuras", why: "Ya sabes qué nota es; ahora, cuánto dura." },
      { kind: "lesson", ref: "compases", why: "El pulso y el acento: por qué la música se agrupa de tres en tres o de cuatro en cuatro." },
      { kind: "exercise", ref: "ritmo", why: "Golpear el ritmo antes de tocarlo es lo que hace que después salga." },
      { kind: "piece", ref: "oda-a-la-alegria", why: "Tu primera pieza: solo notas seguidas y dos acordes. Ya tienes todo lo que pide." },
    ],
  },
  {
    id: "las-dos-manos",
    title: "3. Las dos manos",
    goal: "Tocar una pieza entera de principio a fin con las dos manos.",
    steps: [
      { kind: "lesson", ref: "piano", why: "Postura, numeración de los dedos y cómo se lee un pentagrama doble." },
      { kind: "piece", ref: "campanita-del-lugar", why: "Un salto de quinta al empezar y tres acordes. Ideal para separar manos y juntarlas." },
      { kind: "piece", ref: "cumpleanos-feliz", why: "Empieza antes del compás: la anacrusa se entiende tocándola." },
      { kind: "exercise", ref: "solfeo", why: "Cantar lo que lees fija la altura mucho antes que los dedos." },
      { kind: "piece", ref: "minueto-sol-petzold", why: "Tu primera obra original: el minueto del Cuaderno de Ana Magdalena, con las dos manos de verdad independientes." },
    ],
  },
  {
    id: "tonalidad",
    title: "4. Tonalidad",
    goal: "Mirar una partitura nueva y saber en qué tono está antes de tocar una nota.",
    steps: [
      { kind: "lesson", ref: "armaduras", why: "Los sostenidos y bemoles del principio, y qué tonalidad indican." },
      { kind: "exercise", ref: "armaduras", why: "Reconocer la armadura de un vistazo ahorra medio minuto en cada pieza." },
      { kind: "piece", ref: "jingle-bells", why: "Tu primera pieza con armadura: un sostenido, sol mayor." },
      { kind: "lesson", ref: "escalas", why: "Escalas, intervalos y acordes: de dónde salen las notas que acabas de tocar." },
      { kind: "piece", ref: "satie-gymnopedie-1", why: "Dos sostenidos, acordes de tres notas y pedal: lenta, así que hay tiempo de pensar cada cosa." },
    ],
  },
  {
    id: "todo-lo-que-dice",
    title: "5. Todo lo que dice la partitura",
    goal: "Leer también lo que no son notas: dinámicas, articulaciones, repeticiones.",
    steps: [
      { kind: "lesson", ref: "simbolos", why: "Lo que convierte las notas correctas en música: matices, ligaduras, pedal." },
      { kind: "exercise", ref: "simbolos", why: "Son muchos y se olvidan; las flashcards son para esto." },
      { kind: "exercise", ref: "oido", why: "Reconocer intervalos de oído es lo que te deja adivinar si te has equivocado." },
      { kind: "piece", ref: "clementi-sonatina-op36-1", why: "Una forma sonata entera en 38 compases: escalas, bajo de Alberti y dos temas. Con esto ya lees repertorio." },
    ],
  },
];

export const PATH_STEPS: PathStep[] = PATH.flatMap((s) => s.steps);
