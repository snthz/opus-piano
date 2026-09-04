import { SMUFL } from "@/data/smufl-codepoints";

/**
 * Muestra un glifo SMuFL con la fuente Bravura (original de Steinberg).
 * `size` es el tamaño de fuente en píxeles: en SMuFL 1 em = altura del pentagrama.
 * `inline` usa Bravura Text, pensada para mezclar símbolos con texto corriente.
 */
export function Glyph({
  name,
  size = 48,
  inline = false,
  className = "",
  label,
  color,
}: {
  name: string | string[];
  size?: number;
  inline?: boolean;
  className?: string;
  /** Texto accesible; si se omite, el glifo es decorativo */
  label?: string;
  color?: string;
}) {
  const names = Array.isArray(name) ? name : [name];
  const text = names.map((n) => SMUFL[n] ?? "").join("");
  return (
    <span
      className={`${inline ? "smufl-text" : "smufl"} ${className}`}
      style={{ fontSize: size, color }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {text}
    </span>
  );
}
