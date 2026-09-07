import { z } from "zod";
import { keysWithFifths } from "@/lib/music/keys";
import { checkDurations, linkTies, measureBeats, parseStaffCode } from "@/lib/music/musicxml-build";
import type { ParsedScore, XmlMeasure } from "@/lib/music/musicxml";
import type { ClefName } from "@/components/notation/score";
import { arr, en, int, obj, str, type SchemaNode } from "./schema";

/**
 * Transcripción de la imagen de una partitura a MusicXML con un modelo de
 * visión, hecha en el dispositivo con la clave del usuario.
 *
 * El modelo no devuelve MusicXML: devuelve JSON con esquema estricto donde cada
 * pentagrama de cada compás es una línea en la notación compacta de Opus Piano
 * («C4/q (G4 B4)/h~»), y el MusicXML lo construye la app. Se hace así por tres
 * razones: cabe en una fracción de los tokens que ocupa el XML —una página de
 * piano son miles de etiquetas—, el archivo sale siempre bien formado porque no
 * lo escribe el modelo, y se puede comprobar compás a compás que las duraciones
 * cuadran, que es justo donde estos modelos fallan.
 *
 * Aun así el resultado es un borrador: se etiqueta como tal en toda la interfaz.
 */

/* ---------- Lo que se le pide al modelo ---------- */

/** Páginas como máximo por transcripción: cada una es una petición con imagen y sale cara. */
export const MAX_TRANSCRIBE_PAGES = 6;

const CLEF_NAMES = ["sol", "fa", "do"] as const;
type ClefCode = (typeof CLEF_NAMES)[number];

const CLEF_OF_CODE: Record<ClefCode, ClefName> = { sol: "treble", fa: "bass", do: "alto" };

export const TRANSCRIPTION_SCHEMA: SchemaNode = obj({
  title: str("Título de la pieza tal como aparece impreso; cadena vacía si no consta"),
  composer: str("Compositor tal como aparece impreso; cadena vacía si no consta"),
  fifths: int("Armadura en el círculo de quintas: 0 sin alteraciones, 1 a 7 sostenidos, -1 a -7 bemoles"),
  mode: en(["major", "minor"], "Modo de la tonalidad"),
  beats: int("Numerador del compás: el 3 de 3/4"),
  beatType: int("Denominador del compás: el 4 de 3/4"),
  tempo: int("Negras por minuto si la partitura lo indica con cifra; 0 si no"),
  clefs: arr(en(CLEF_NAMES), "Una clave por pentagrama, de arriba abajo. En piano, casi siempre [«sol», «fa»]"),
  measures: arr(
    obj({
      number: int("Número del compás"),
      staves: arr(str("Los eventos del pentagrama separados por espacios, o «-» si no tiene ninguno"), "Una entrada por pentagrama, en el mismo orden que «clefs»"),
    }),
    "Los compases de esta página, en orden de lectura",
  ),
});

export const transcriptionSchema = z.object({
  title: z.string().max(300),
  composer: z.string().max(300),
  fifths: z.number().int().min(-7).max(7),
  mode: z.enum(["major", "minor"]),
  beats: z.number().int().min(1).max(32),
  beatType: z.number().int().min(1).max(64),
  tempo: z.number().int().min(0).max(400),
  clefs: z.array(z.enum(CLEF_NAMES)).min(1).max(2),
  measures: z.array(z.object({ number: z.number().int().min(0), staves: z.array(z.string().max(4000)).max(2) })).max(300),
});
export type Transcription = z.infer<typeof transcriptionSchema>;

/* ---------- Instrucciones ---------- */

export const NOTATION_RULES = [
  "- Una nota es «nombre/figura». El nombre va en anglosajón con octava científica (C4 = do central) y con la alteración REAL ya aplicada, no la impresa: C4, F#4, Bb3, G#5.",
  "- Figuras: w redonda, h blanca, q negra, 8 corchea, 16 semicorchea, 32 fusa, 64 semifusa. El puntillo se añade con «.»: «h.» es blanca con puntillo.",
  "- Silencio: «r/figura», por ejemplo «r/q».",
  "- Acorde: las notas entre paréntesis y de grave a agudo, con una sola figura: «(C4 E4 G4)/h».",
  "- Ligadura de unión: «~» al final de la nota donde empieza, «C4/h~». La nota siguiente es su continuación; no marques el final.",
  "- Los eventos van separados por un espacio y en orden. Un pentagrama sin notas en ese compás se escribe «-».",
].join("\n");

export function transcribeInstructions(): string {
  return [
    "Eres un sistema de reconocimiento óptico de partituras. Recibes la imagen de una página de una partitura de piano y devuelves lo que hay escrito, compás a compás.",
    "No devuelves MusicXML: devuelves cada pentagrama de cada compás como una línea de texto en esta notación compacta, y la app construye el MusicXML a partir de ella.",
    "",
    "Notación:",
    NOTATION_RULES,
    "",
    "Reglas de lectura:",
    "- La alteración que escribes es la que suena. Si la armadura lleva fa sostenido, un fa escrito sin alteración es «F#»; si tiene un becuadro impreso, es «F». Una alteración accidental vale hasta el final de su compás y solo en su octava.",
    "- Las figuras de cada compás deben sumar exactamente lo que pide el compás: en 3/4, tres negras. Esto es lo más importante de la transcripción; si dudas entre dos figuras, elige la que hace cuadrar el compás.",
    "- Una sola voz por pentagrama. Si hay varias, transcribe la principal (la superior en la mano derecha, la inferior en la izquierda) y funde con ella, como acorde, las notas de las demás que empiecen en el mismo tiempo y duren lo mismo.",
    "- Transcribe solo los compases que se ven enteros en esta página y en orden de lectura: primer sistema de izquierda a derecha, luego el siguiente.",
    "- Las repeticiones, casillas y saltos no se transcriben: escribe los compases una sola vez, tal como están impresos.",
    "- Omite dinámicas, articulaciones, pedal, digitaciones, letra y adornos: no caben en esta notación y no hacen falta.",
    "- No inventes compases que no estén en la página. Si un pasaje no se lee bien, transcribe lo que se distinga y respeta la duración del compás con silencios.",
  ].join("\n");
}

/** Cabecera ya conocida por la página 1; las siguientes la repiten para no cambiar de criterio a mitad. */
export interface KnownHeader {
  fifths: number;
  mode: "major" | "minor";
  beats: number;
  beatType: number;
  tempo: number;
  clefs: ClefCode[];
}

export const headerOf = (t: Transcription): KnownHeader => ({
  fifths: t.fifths, mode: t.mode, beats: t.beats, beatType: t.beatType, tempo: t.tempo, clefs: t.clefs,
});

export interface PageRequest {
  scoreName: string;
  /** Página del PDF que se envía y cuántas se transcriben en total */
  page: number;
  index: number;
  total: number;
  /** Número que le toca al primer compás de esta página */
  firstMeasure: number;
  header: KnownHeader | null;
}

export function transcribeUserMessage(req: PageRequest): string {
  const parts = [
    `Partitura: «${req.scoreName}». Se transcriben ${req.total} página(s); esta es la ${req.index} (página ${req.page} del PDF).`,
    `Numera los compases de esta página a partir del ${req.firstMeasure}.`,
  ];
  if (req.header) {
    const key = keysWithFifths(req.header.fifths);
    const name = req.header.mode === "minor" ? key.minor.vex : key.major.vex;
    parts.push(
      `La cabecera ya se leyó en la primera página y debes repetirla tal cual: fifths ${req.header.fifths} (${name}), mode «${req.header.mode}», ` +
        `compás ${req.header.beats}/${req.header.beatType}, tempo ${req.header.tempo}, clefs [${req.header.clefs.join(", ")}]. ` +
        "Devuelve también el mismo título y compositor. Solo si esta página cambia de armadura o de compás, pon los valores nuevos.",
    );
  } else {
    parts.push("Lee también la cabecera: título, compositor, armadura, modo, compás, tempo si viene con cifra y las claves de los pentagramas.");
  }
  return parts.join("\n");
}

/* ---------- De la respuesta del modelo a una partitura ---------- */

export interface Assembled {
  score: ParsedScore;
  composer: string;
  /** Lo que no se pudo leer o no cuadra; se le enseña al usuario tal cual */
  warnings: string[];
}

/**
 * Junta las páginas en una sola partitura. La cabecera es la de la primera; los
 * compases se numeran de corrido desde el primero para que no haya saltos ni
 * repetidos aunque el modelo se despiste contando.
 *
 * Un pentagrama que no se entiende no tira abajo la transcripción entera: se
 * queda vacío y se avisa, que es más útil que perder las diez páginas buenas.
 */
export function assemble(pages: Transcription[]): Assembled {
  if (!pages.length) throw new Error("No se ha transcrito ninguna página.");
  const head = pages[0];
  const clefs = head.clefs.map((c) => CLEF_OF_CODE[c]);
  const key = keysWithFifths(head.fifths);
  const warnings: string[] = [];
  const measures: XmlMeasure[] = [];
  const start = pages[0].measures[0]?.number ?? 1;

  for (const page of pages) {
    for (const m of page.measures) {
      const number = String(start + measures.length);
      const staves = clefs.map((_, si) => {
        try {
          return parseStaffCode(m.staves[si] ?? "");
        } catch (e) {
          warnings.push(`Compás ${number}, pentagrama ${si + 1}: ${e instanceof Error ? e.message : "no se entiende"}`);
          return [];
        }
      });
      measures.push({ number, staves });
    }
  }
  linkTies(measures, clefs.length);

  const score: ParsedScore = {
    title: head.title.trim(),
    keyVex: head.mode === "minor" ? key.minor.vex : key.major.vex,
    time: { num: head.beats, den: head.beatType },
    tempo: head.tempo,
    clefs,
    measures,
  };

  const expected = measureBeats(score.time);
  for (const issue of checkDurations(score)) {
    warnings.push(`Compás ${issue.measure}, pentagrama ${issue.staff + 1}: dura ${round(issue.beats)} en vez de ${round(expected)} negras`);
  }
  return { score, composer: head.composer.trim(), warnings };
}

const round = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
