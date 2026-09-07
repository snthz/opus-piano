/**
 * Tema de la interfaz. La preferencia vive en los ajustes (localStorage) y se
 * aplica marcando `data-theme` en el <html>; el CSS de `globals.css` y los
 * controles nativos del navegador (`color-scheme`) siguen esa marca.
 */

export type Theme = "system" | "light" | "dark";

export const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
];

/** Color de la barra del navegador; debe coincidir con --bg de cada paleta. */
export const THEME_COLORS = { light: "#f3f3f6", dark: "#121215" } as const;

/** Misma clave que usa `@/lib/settings`; el script de arranque no puede importarla. */
const STORAGE_KEY = "etude:settings";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return "light";
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  // Las metas que genera Next llevan `media`, así que con un tema forzado
  // pueden quedar al revés: se reescriben todas con el color ya resuelto.
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", THEME_COLORS[resolved]));
}

/** Avisa cuando cambia la preferencia del sistema (solo importa con "system"). */
export function watchSystemTheme(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Se ejecuta antes de pintar la página para que no haya destello claro al
 * cargar con el tema oscuro. Sin JavaScript queda la paleta clara.
 */
export const THEME_INIT_SCRIPT = `(function(){var t="system";try{var s=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});if(s)t=JSON.parse(s).theme||"system"}catch(e){}var d=t==="dark"||(t!=="light"&&window.matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches);var r=document.documentElement;r.dataset.theme=d?"dark":"light";r.style.colorScheme=d?"dark":"light"})()`;
