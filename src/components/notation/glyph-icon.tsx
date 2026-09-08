import { SMUFL } from "@/data/smufl-codepoints";
import { GLYPH_BBOX, GLYPH_ADVANCE } from "@/data/smufl-bbox";
import { Glyph } from "./glyph";

/** Ink box of several glyphs in a row, each starting after the previous one's advance. */
function composeBox(names: string[]): [number, number, number, number] | null {
  let pen = 0;
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const n of names) {
    const b = GLYPH_BBOX[n];
    if (!b) return null;
    left = Math.min(left, pen + b[0]);
    right = Math.max(right, pen + b[0] + b[2]);
    top = Math.min(top, b[1]);
    bottom = Math.max(bottom, b[1] + b[3]);
    pen += GLYPH_ADVANCE[n] ?? b[2];
  }
  if (!(right > left) || !(bottom > top)) return null;
  return [left, top, right - left, bottom - top];
}

/**
 * A SMuFL glyph cropped to its actual drawing (viewBox = ink box measured in
 * `smufl-bbox.ts`), instead of centered on the text baseline. Use `Glyph` for
 * inline text.
 */
export function GlyphIcon({
  name,
  size = 24,
  fit = "box",
  className = "",
  label,
  color,
}: {
  name: string | string[];
  /** Box side (fit="box") or size of one em (fit="em"), in pixels. */
  size?: number;
  /** "box": same size for every icon. "em": keeps the glyph's real proportions. */
  fit?: "box" | "em";
  className?: string;
  /** Accessible label; the icon is decorative if omitted. */
  label?: string;
  color?: string;
}) {
  const names = Array.isArray(name) ? name : [name];
  const char = names.map((n) => SMUFL[n] ?? "").join("");
  const box = composeBox(names);
  // glyph not measured yet: fall back to text rendering
  if (!char || !box) return <Glyph name={name} size={size} className={className} label={label} color={color} />;

  const [x, y, w, h] = box;
  return (
    <svg
      viewBox={`${x} ${y} ${w} ${h}`}
      width={fit === "em" ? size * w : size}
      height={fit === "em" ? size * h : size}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ color }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <text x={0} y={0} fontFamily="Bravura" fontSize={1} fill="currentColor">
        {char}
      </text>
    </svg>
  );
}
