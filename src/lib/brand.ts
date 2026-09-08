/**
 * Opus Piano's mark: an "O" with three black keys, like a piano seen head-on.
 * Single source of the logo (`LogoMark`, Open Graph, `gen-icons.mjs`); re-run
 * `bun run gen:icons` after changing it.
 */
export const LOGO_MARK_VIEWBOX = "0 0 32 32";

export const LOGO_MARK_PATH = [
  "M16 2a14 14 0 1 1 0 28 14 14 0 1 1 0-28Z", // disc
  "M7.8 7a.8.8 0 0 1 .8-.8h2.4a.8.8 0 0 1 .8.8v10a2 2 0 0 1-4 0Z", // left key
  "M14 6a.8.8 0 0 1 .8-.8h2.4a.8.8 0 0 1 .8.8v10a2 2 0 0 1-4 0Z", // center key
  "M20.2 7a.8.8 0 0 1 .8-.8h2.4a.8.8 0 0 1 .8.8v10a2 2 0 0 1-4 0Z", // right key
].join("");

/** Brand colors for icons that can't use `currentColor`. */
export const BRAND_COLORS = {
  ink: "#111114", // same black as --ink in light mode
  tile: "#f3f3f6", // icon background and manifest theme_color
  inkDark: "#f2f2f5", // dark-mode ink for the SVG favicon
} as const;
