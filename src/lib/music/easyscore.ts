/** An EasyScore figure ("pitch/duration/type/dots"); a dotted rest is "B4/h/r.", not "B4/h./r". */
export function easyScorePiece(keys: string, vex: string, rest = false): string {
  if (!rest) return `${keys}/${vex}`;
  const dots = vex.replace(/[^.]/g, "");
  return `${keys}/${vex.replace(/\./g, "")}/r${dots}`;
}
