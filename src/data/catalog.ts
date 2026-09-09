import type { CatalogMusic } from "@/lib/music/catalog-score";
import type { Level } from "@/lib/study-plan";

/**
 * Piezas de dominio público para empezar a tocar sin subir nada.
 *
 * La biblioteca vacía es lo primero que ve alguien que acaba de entrar, y
 * pedirle un PDF antes de darle nada es pedirle trabajo. Estas piezas se
 * añaden a su biblioteca con un toque y, como salen en MusicXML, traen todo
 * lo que la app sabe hacer: suenan, se ven nota a nota y se les puede pedir
 * un análisis.
 *
 * Sobre los derechos: todas son obras cuyo autor murió hace más de un siglo o
 * tradicionales sin autor conocido, así que la *obra* es de dominio público.
 * La *edición* también, porque estas transcripciones están escritas aquí, no
 * copiadas de una partitura ajena: son arreglos sencillos propios sobre la
 * melodía original. Por eso cada ficha dice «arreglo» y no «urtext».
 *
 * Para añadir una pieza basta con escribirla abajo en la notación compacta
 * (ver `catalog-score.ts`); `tests/unit/catalog.test.ts` comprueba que los
 * compases cuadren y que el MusicXML se pueda volver a leer.
 */

export interface CatalogPiece {
  id: string;
  title: string;
  composer: string;
  /** Año de la obra original: es lo que deja claro por qué puede estar aquí. */
  year: string;
  level: Level;
  /** Qué se practica con ella, en una frase. */
  about: string;
  /** Lo que conviene haber visto antes, para enlazarlo con las lecciones. */
  skills: string[];
  music: CatalogMusic;
}

const C_MAJOR_CHORDS = {
  C: "(C3 E3 G3)",
  F: "(F2 A2 C3)",
  G: "(G2 B2 D3)",
};

const G_MAJOR_CHORDS = {
  G: "(G2 B2 D3)",
  C: "(C3 E3 G3)",
  D: "(D3 F#3 A3)",
};

const { C, F, G } = C_MAJOR_CHORDS;

export const CATALOG: CatalogPiece[] = [
  {
    id: "oda-a-la-alegria",
    title: "Oda a la alegría",
    composer: "Ludwig van Beethoven",
    year: "1824",
    level: "principiante",
    about: "El tema de la Novena sinfonía. Solo grados conjuntos en la mano derecha y dos acordes en la izquierda.",
    skills: ["Notas de do4 a sol4 en clave de sol", "Negras, blancas y el puntillo", "Acordes de do y sol en la mano izquierda"],
    music: {
      keyVex: "C",
      time: { num: 4, den: 4 },
      tempo: 100,
      measures: [
        { staves: ["E4/q E4/q F4/q G4/q", `${C}/w`] },
        { staves: ["G4/q F4/q E4/q D4/q", `${C}/h ${G}/h`] },
        { staves: ["C4/q C4/q D4/q E4/q", `${C}/h ${G}/h`] },
        { staves: ["E4/q. D4/8 D4/h", `${G}/w`] },
        { staves: ["E4/q E4/q F4/q G4/q", `${C}/w`] },
        { staves: ["G4/q F4/q E4/q D4/q", `${C}/h ${G}/h`] },
        { staves: ["C4/q C4/q D4/q E4/q", `${C}/h ${G}/h`] },
        { staves: ["D4/q. C4/8 C4/h", `${G}/h ${C}/h`] },
        { staves: ["D4/q D4/q E4/q C4/q", `${G}/h ${C}/h`] },
        { staves: ["D4/q E4/8 F4/8 E4/q C4/q", `${G}/h ${C}/h`] },
        { staves: ["D4/q E4/8 F4/8 E4/q D4/q", `${G}/w`] },
        { staves: ["C4/q D4/q G3/h", `${C}/h ${G}/h`] },
        { staves: ["E4/q E4/q F4/q G4/q", `${C}/w`] },
        { staves: ["G4/q F4/q E4/q D4/q", `${C}/h ${G}/h`] },
        { staves: ["C4/q C4/q D4/q E4/q", `${C}/h ${G}/h`] },
        { staves: ["D4/q. C4/8 C4/h", `${G}/h ${C}/h`] },
      ],
    },
  },
  {
    id: "campanita-del-lugar",
    title: "Campanita del lugar",
    composer: "Tradicional (tema de las variaciones K. 265 de Mozart)",
    year: "s. XVIII",
    level: "principiante",
    about: "La melodía con la que casi todo el mundo empieza. Salto de quinta al principio y después todo por grados.",
    skills: ["El salto de do4 a sol4", "Negras y blancas", "Tres acordes: do, fa y sol"],
    music: {
      keyVex: "C",
      time: { num: 4, den: 4 },
      tempo: 108,
      measures: [
        { staves: ["C4/q C4/q G4/q G4/q", `${C}/w`] },
        { staves: ["A4/q A4/q G4/h", `${F}/h ${C}/h`] },
        { staves: ["F4/q F4/q E4/q E4/q", `${F}/h ${C}/h`] },
        { staves: ["D4/q D4/q C4/h", `${G}/h ${C}/h`] },
        { staves: ["G4/q G4/q F4/q F4/q", `${C}/w`] },
        { staves: ["E4/q E4/q D4/h", `${G}/w`] },
        { staves: ["G4/q G4/q F4/q F4/q", `${C}/w`] },
        { staves: ["E4/q E4/q D4/h", `${G}/w`] },
        { staves: ["C4/q C4/q G4/q G4/q", `${C}/w`] },
        { staves: ["A4/q A4/q G4/h", `${F}/h ${C}/h`] },
        { staves: ["F4/q F4/q E4/q E4/q", `${F}/h ${C}/h`] },
        { staves: ["D4/q D4/q C4/h", `${G}/h ${C}/h`] },
      ],
    },
  },
  {
    id: "cumpleanos-feliz",
    title: "Cumpleaños feliz",
    composer: "Tradicional (sobre «Good Morning to All», de Patty y Mildred Hill)",
    year: "1893",
    level: "principiante",
    about: "Empieza antes del primer compás: es la anacrusa más famosa que hay, y se toca a caballo entre las dos claves.",
    skills: ["Anacrusa y compás de 3/4", "El puntillo: corchea con puntillo y semicorchea", "Leer alrededor del do central"],
    music: {
      keyVex: "C",
      time: { num: 3, den: 4 },
      tempo: 96,
      pickup: true,
      measures: [
        { staves: ["G3/8. G3/16", "r/q"] },
        { staves: ["A3/q G3/q C4/q", `${C}/h.`] },
        { staves: ["B3/h G3/8. G3/16", `${G}/h.`] },
        { staves: ["A3/q G3/q D4/q", `${C}/h.`] },
        { staves: ["C4/h G3/8. G3/16", `${C}/h.`] },
        { staves: ["G4/q E4/q C4/q", `${C}/h.`] },
        { staves: ["B3/q A3/q F4/8. F4/16", `${G}/q ${F}/h`] },
        { staves: ["E4/q C4/q D4/q", `${C}/q ${G}/h`] },
        { staves: ["C4/h.", `${C}/h.`] },
      ],
    },
  },
  {
    id: "jingle-bells",
    title: "Jingle Bells (estribillo)",
    composer: "James Lord Pierpont",
    year: "1857",
    level: "elemental",
    about: "La primera con armadura: un sostenido, sol mayor. Repite mucho la misma nota, así que la cabeza queda libre para el ritmo.",
    skills: ["Armadura de sol mayor (fa sostenido)", "Negra con puntillo y corchea", "Cambiar entre tres acordes: sol, do y re"],
    music: {
      keyVex: "G",
      time: { num: 4, den: 4 },
      tempo: 120,
      measures: [
        { staves: ["B4/q B4/q B4/h", `${G_MAJOR_CHORDS.G}/w`] },
        { staves: ["B4/q B4/q B4/h", `${G_MAJOR_CHORDS.G}/w`] },
        { staves: ["B4/q D5/q G4/q. A4/8", `${G_MAJOR_CHORDS.G}/w`] },
        { staves: ["B4/w", `${G_MAJOR_CHORDS.G}/w`] },
        { staves: ["C5/q C5/q C5/q. C5/8", `${G_MAJOR_CHORDS.C}/w`] },
        { staves: ["C5/q B4/q B4/8 B4/8 B4/8 B4/8", `${G_MAJOR_CHORDS.C}/h ${G_MAJOR_CHORDS.G}/h`] },
        { staves: ["B4/q A4/q A4/q B4/q", `${G_MAJOR_CHORDS.G}/h ${G_MAJOR_CHORDS.D}/h`] },
        { staves: ["A4/h D5/h", `${G_MAJOR_CHORDS.D}/w`] },
        { staves: ["B4/q B4/q B4/h", `${G_MAJOR_CHORDS.G}/w`] },
        { staves: ["B4/q B4/q B4/h", `${G_MAJOR_CHORDS.G}/w`] },
        { staves: ["B4/q D5/q G4/q. A4/8", `${G_MAJOR_CHORDS.G}/w`] },
        { staves: ["B4/w", `${G_MAJOR_CHORDS.G}/w`] },
        { staves: ["C5/q C5/q C5/q. C5/8", `${G_MAJOR_CHORDS.C}/w`] },
        { staves: ["C5/q B4/q B4/8 B4/8 B4/8 B4/8", `${G_MAJOR_CHORDS.C}/h ${G_MAJOR_CHORDS.G}/h`] },
        { staves: ["D5/q D5/q C5/q A4/q", `${G_MAJOR_CHORDS.D}/w`] },
        { staves: ["G4/w", `${G_MAJOR_CHORDS.G}/w`] },
      ],
    },
  },
];

export const pieceById = (id: string): CatalogPiece | undefined => CATALOG.find((p) => p.id === id);

/** Las piezas agrupadas por nivel, en el orden en que conviene tocarlas. */
export const LEVEL_ORDER: Level[] = ["principiante", "elemental", "intermedio", "avanzado"];

export function piecesByLevel(): { level: Level; pieces: CatalogPiece[] }[] {
  return LEVEL_ORDER.map((level) => ({ level, pieces: CATALOG.filter((p) => p.level === level) })).filter((g) => g.pieces.length > 0);
}
