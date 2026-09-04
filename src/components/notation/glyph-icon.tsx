import { SMUFL } from "@/data/smufl-codepoints";
import { GLYPH_BBOX, GLYPH_ADVANCE } from "@/data/smufl-bbox";
import { Glyph } from "./glyph";

/**
 * Caja de tinta de uno o varios glifos dibujados seguidos. Cada glifo empieza
 * donde lo dejó el anterior (su avance), así que la caja total va del borde
 * izquierdo del primero al derecho del último, y de la cima más alta a la más baja.
 */
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
 * Un glifo SMuFL recortado a su dibujo real.
 *
 * Los glifos SMuFL se apoyan en una línea base situada en el centro del
 * pentagrama, y cada uno sobresale de forma muy distinta: la clave de sol mide
 * 1,76 em de alto y un staccato 0,08. Al colocarlos como texto se centra la caja
 * de la línea, no el dibujo, y por eso quedaban descolocados. Aquí el viewBox es
 * la caja de tinta medida en `smufl-bbox.ts`, así que el dibujo queda centrado.
 *
 * Para símbolos dentro de un texto corrido usa `Glyph`, que respeta la línea base.
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
  /** Con fit="box", el lado del cuadro; con fit="em", el tamaño de una em. En píxeles. */
  size?: number;
  /**
   * `box`: el glifo llena un cuadro de `size`×`size`. Todos los iconos pesan
   * lo mismo, que es lo que se quiere en insignias y navegación.
   *
   * `em`: el elemento mide exactamente lo que el dibujo, a su escala real.
   * Conserva las proporciones de la notación —una clave de sol es más alta que
   * una de fa— y es lo correcto al comparar símbolos entre sí.
   */
  fit?: "box" | "em";
  className?: string;
  /** Texto accesible; si se omite, el icono es decorativo */
  label?: string;
  color?: string;
}) {
  const names = Array.isArray(name) ? name : [name];
  const char = names.map((n) => SMUFL[n] ?? "").join("");
  const box = composeBox(names);
  // Glifo aún no medido: se cae al render de texto en lugar de no dibujar nada.
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
