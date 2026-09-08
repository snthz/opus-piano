/**
 * Una figura en notación EasyScore.
 *
 * La gramática de EasyScore es «altura / duración / tipo / puntillos»: un
 * silencio con puntillo se escribe «B4/h/r.» y no «B4/h./r», que no analiza y
 * tumba el dibujo de la partitura entera.
 */
export function easyScorePiece(keys: string, vex: string, rest = false): string {
  if (!rest) return `${keys}/${vex}`;
  const dots = vex.replace(/[^.]/g, "");
  return `${keys}/${vex.replace(/\./g, "")}/r${dots}`;
}
