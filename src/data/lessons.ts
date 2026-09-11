export interface Lesson {
  slug: string;
  title: string;
  summary: string;
  /** Glifo SMuFL representativo */
  glyph: string;
  /** Minutos aproximados de lectura */
  minutes: number;
}

export interface LessonSection {
  id: string;
  title: string;
  lessons: Lesson[];
}

export const LESSON_SECTIONS: LessonSection[] = [
  {
    id: "leer",
    title: "I. Leer el pentagrama",
    lessons: [
      {
        slug: "pentagrama",
        title: "El pentagrama",
        summary: "Líneas, espacios, líneas adicionales y cómo se ordenan las notas de grave a agudo.",
        glyph: "staff5Lines",
        minutes: 6,
      },
      {
        slug: "claves",
        title: "Las claves",
        summary: "Clave de sol, clave de fa y clave de do. El gran pentagrama del piano.",
        glyph: "gClef",
        minutes: 10,
      },
      {
        slug: "notas",
        title: "Las notas y el teclado",
        summary: "Nombres, octavas, alteraciones, enarmonías y dónde está cada nota en el piano.",
        glyph: "accidentalSharp",
        minutes: 12,
      },
      {
        slug: "figuras",
        title: "Figuras y silencios",
        summary: "Redonda, blanca, negra, corchea… puntillo, ligadura y tresillo.",
        glyph: "noteQuarterUp",
        minutes: 10,
      },
    ],
  },
  {
    id: "ritmo-tonalidad",
    title: "II. Compases, símbolos y tonalidad",
    lessons: [
      {
        slug: "compases",
        title: "Los compases",
        summary: "Pulso, acento, compases simples y compuestos, anacrusa y barras.",
        glyph: "timeSigCommon",
        minutes: 12,
      },
      {
        slug: "simbolos",
        title: "Símbolos de la partitura",
        summary: "Dinámicas, articulaciones, adornos, repeticiones, pedal y más, con los glifos originales.",
        glyph: "dynamicForte",
        minutes: 15,
      },
      {
        slug: "armaduras",
        title: "Armaduras y tonalidades",
        summary: "Sostenidos y bemoles en la armadura, círculo de quintas, relativos mayores y menores.",
        glyph: "accidentalFlat",
        minutes: 12,
      },
      {
        slug: "escalas",
        title: "Escalas, intervalos y acordes",
        summary: "Tonos y semitonos, escalas mayores y menores, intervalos y tríadas básicas.",
        glyph: "keyboardPedalPed",
        minutes: 14,
      },
    ],
  },
  {
    id: "al-piano",
    title: "III. Sentarse al piano",
    lessons: [
      {
        slug: "postura",
        title: "Postura y posición de la mano",
        summary: "Cómo sentarse, a qué altura, el arco de la mano y ejercicios para tocar sin tensión.",
        glyph: "fingering1",
        minutes: 9,
      },
      {
        slug: "piano",
        title: "Técnica básica del piano",
        summary: "Numeración de los dedos, paso del pulgar, pedal y lectura a dos manos.",
        glyph: "fingering3",
        minutes: 10,
      },
    ],
  },
];

export const ALL_LESSONS: Lesson[] = LESSON_SECTIONS.flatMap((s) => s.lessons);

export function lessonBySlug(slug: string): Lesson | undefined {
  return ALL_LESSONS.find((l) => l.slug === slug);
}

export function lessonNeighbors(slug: string): { prev?: Lesson; next?: Lesson } {
  const i = ALL_LESSONS.findIndex((l) => l.slug === slug);
  return { prev: i > 0 ? ALL_LESSONS[i - 1] : undefined, next: i >= 0 ? ALL_LESSONS[i + 1] : undefined };
}
