import { buildMusicXml, linkTies, parseStaffCode } from "./musicxml-build";
import type { ParsedScore, XmlMeasure } from "./musicxml";
import type { ClefName } from "@/components/notation/score";

/**
 * The catalog's pieces, written the short way.
 *
 * Public-domain music has to live somewhere, and a MusicXML file is a wall of
 * angle brackets nobody can proofread. So a piece is written here in the same
 * compact notation the app already speaks ("C4/q", "(G4 B4)/h~", "r/8", from
 * `musicxml-build.ts`): one string per staff per measure, right hand first.
 * `buildCatalogScore` turns that into the real MusicXML the reader, the
 * player and the analysis all consume — there is no second format to keep in
 * sync, and `checkDurations` can audit every piece in a test.
 */

export interface CatalogMeasure {
  /** Right hand, then left. A missing or "-" staff means that hand rests through the measure. */
  staves: [string, string];
  repeatStart?: boolean;
  repeatEnd?: boolean;
  /** 1 for the "1." ending, 2 for "2.". */
  ending?: number;
}

export interface CatalogMusic {
  /** Key signature in VexFlow notation: "C", "G", "Am"… */
  keyVex: string;
  time: { num: number; den: number };
  /** Quarter notes per minute. */
  tempo: number;
  clefs?: ClefName[];
  measures: CatalogMeasure[];
  /**
   * The piece starts on an upbeat, so measure 1 is short on purpose and the
   * numbering starts at 0 — as it's printed.
   */
  pickup?: boolean;
}

/** The compact notation expanded into the same structure `parseMusicXml` produces. */
export function parseCatalogMusic(music: CatalogMusic, title: string): ParsedScore {
  const clefs = music.clefs ?? (["treble", "bass"] as ClefName[]);
  const measures: XmlMeasure[] = music.measures.map((m, i) => ({
    number: String(music.pickup ? i : i + 1),
    staves: m.staves.map(parseStaffCode),
    repeatStart: m.repeatStart,
    repeatEnd: m.repeatEnd,
    ending: m.ending,
  }));
  linkTies(measures, clefs.length);
  return { title, keyVex: music.keyVex, time: music.time, tempo: music.tempo, clefs, measures };
}

/** MusicXML for a catalog piece, ready to drop into the library like an uploaded file. */
export function catalogMusicXml(music: CatalogMusic, title: string, composer: string): string {
  return buildMusicXml(parseCatalogMusic(music, title), { composer, software: "Opus Piano — catálogo de dominio público" });
}
