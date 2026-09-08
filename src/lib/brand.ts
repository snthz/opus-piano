/**
 * Marca de Opus Piano: una «O» (de Opus) con tres teclas negras recortadas,
 * como un piano visto de frente. Las teclas siguen la curva del disco (las de
 * los extremos cuelgan un poco más abajo) y tienen el mismo largo, con el tope
 * casi recto y la punta redondeada, igual que una tecla de verdad.
 *
 * El trazado es un solo `path` con `fill-rule: evenodd`: el disco relleno y
 * las teclas como huecos transparentes. Así funciona con `currentColor` sobre
 * cualquier fondo y en modo oscuro sin variantes.
 *
 * Es la única fuente del logotipo: el componente `LogoMark`, la imagen de
 * Open Graph y `scripts/gen-icons.mjs` (favicon, ícono de Apple y del PWA)
 * lo leen de aquí. Al cambiarlo, hay que volver a ejecutar `bun run gen:icons`.
 */
export const LOGO_MARK_VIEWBOX = "0 0 32 32";

export const LOGO_MARK_PATH = [
  // Disco de radio 14 centrado en (16, 16).
  "M16 2a14 14 0 1 1 0 28 14 14 0 1 1 0-28Z",
  // Tecla izquierda.
  "M7.8 7a.8.8 0 0 1 .8-.8h2.4a.8.8 0 0 1 .8.8v10a2 2 0 0 1-4 0Z",
  // Tecla central, un poco más alta porque el borde del disco también lo está.
  "M14 6a.8.8 0 0 1 .8-.8h2.4a.8.8 0 0 1 .8.8v10a2 2 0 0 1-4 0Z",
  // Tecla derecha.
  "M20.2 7a.8.8 0 0 1 .8-.8h2.4a.8.8 0 0 1 .8.8v10a2 2 0 0 1-4 0Z",
].join("");

/** Colores de la marca en los íconos que no pueden usar `currentColor` (PWA, Apple, Open Graph). */
export const BRAND_COLORS = {
  /** Tinta: mismo negro que `--ink` en modo claro. */
  ink: "#111114",
  /** Fondo de los íconos: mismo gris que `--bg` y que `theme_color` del manifiesto. */
  tile: "#f3f3f6",
  /** Tinta en modo oscuro, para el favicon SVG. */
  inkDark: "#f2f2f5",
} as const;
