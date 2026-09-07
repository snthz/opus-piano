"use client";

import { useEffect } from "react";
import { useSettings } from "@/lib/settings";
import { applyTheme, watchSystemTheme } from "@/lib/theme";

/**
 * Mantiene el <html> sincronizado con la preferencia de tema: al cambiarla en
 * Ajustes y, cuando está en "system", al cambiar el tema del sistema.
 */
export function ThemeEffect() {
  const { settings } = useSettings();
  const theme = settings.theme;

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    return watchSystemTheme(() => applyTheme("system"));
  }, [theme]);

  return null;
}
