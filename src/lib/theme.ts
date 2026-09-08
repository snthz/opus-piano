/**
 * UI theme. The preference lives in settings (localStorage) and applies via
 * `data-theme` on <html>; `globals.css` and native browser controls
 * (`color-scheme`) follow that.
 */

export type Theme = "system" | "light" | "dark";

export const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
];

/** Browser chrome color; must match --bg in each palette. */
export const THEME_COLORS = { light: "#f3f3f6", dark: "#121215" } as const;

/** Same key as `@/lib/settings`; the boot script can't import it. */
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
  // Next's generated meta tags carry `media`, which can end up backwards under a forced theme
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", THEME_COLORS[resolved]));
}

/** Notifies when the system preference changes (only matters for "system"). */
export function watchSystemTheme(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Runs before paint to avoid a light flash on load with a dark theme. Falls back to light without JS. */
export const THEME_INIT_SCRIPT = `(function(){var t="system";try{var s=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});if(s)t=JSON.parse(s).theme||"system"}catch(e){}var d=t==="dark"||(t!=="light"&&window.matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches);var r=document.documentElement;r.dataset.theme=d?"dark":"light";r.style.colorScheme=d?"dark":"light"})()`;
