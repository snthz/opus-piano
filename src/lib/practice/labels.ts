import { INTERVALS } from "@/lib/music/scales";
import { keyByVex, keyName } from "@/lib/music/keys";
import { fullName, parsePitch, type NamingSystem } from "@/lib/music/pitch";
import { symbolById } from "@/data/symbols";

/**
 * What to call an item in the weak-points list.
 *
 * Item ids are stable and language-free ("bass|F3") so the record survives a
 * change of note naming; the name is built here, when it's read. Each
 * exercise decides the shape of its own ids:
 *
 * - `notas`, `teclado`: "<clave>|<nota EasyScore>" — "bass|F3"
 * - `armaduras`: the key in VexFlow notation — "Eb"
 * - `simbolos`: the symbol id — "calderon"
 * - `oido`: "<semitonos>|<movimiento>" — "7|asc"
 */

const CLEF_NAMES: Record<string, string> = { treble: "clave de sol", bass: "clave de fa" };
const MOTION_NAMES: Record<string, string> = { asc: "ascendente", desc: "descendente", harm: "simultáneo" };

export function itemLabel(exerciseId: string, itemId: string, naming: NamingSystem = "latino"): string {
  try {
    switch (exerciseId) {
      case "notas":
      case "teclado": {
        const [clef, note] = itemId.split("|");
        return `${fullName(parsePitch(note), naming)} en ${CLEF_NAMES[clef] ?? clef}`;
      }
      case "armaduras":
        return keyName(keyByVex(itemId), naming);
      case "simbolos":
        return symbolById(itemId)?.name ?? itemId;
      case "oido": {
        const [semitones, motion] = itemId.split("|");
        const interval = INTERVALS.find((i) => i.semitones === Number(semitones));
        return `${interval?.name ?? `${semitones} semitonos`} (${MOTION_NAMES[motion] ?? motion})`;
      }
      default:
        return itemId;
    }
  } catch {
    return itemId;
  }
}
