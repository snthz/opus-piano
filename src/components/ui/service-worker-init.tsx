"use client";

import { useEffect, useState } from "react";
import { ClientOnly } from "./client-only";

/**
 * Registra el service worker y avisa cuando hay una versión nueva.
 * El SW usa skipWaiting, así que toma el control en cuanto se activa:
 * la página que ya estaba abierta necesita recargarse para usar el código nuevo.
 */
export function ServiceWorkerInit() {
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Si no había controlador, es la primera instalación: no es una actualización.
    const hadController = !!navigator.serviceWorker.controller;
    const onChange = () => {
      if (hadController) setUpdated(true);
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onChange);
  }, []);

  if (!updated) return null;

  return (
    <div className="fixed bottom-28 lg:bottom-4 left-4 right-4 max-w-sm mx-auto bg-ink text-bg rounded-3xl shadow-lg p-4 flex items-center gap-3 z-50">
      <p className="flex-1 text-sm font-medium">Hay una versión nueva de Opus Piano.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="pill text-xs py-1.5 shrink-0 bg-bg text-ink"
      >
        Actualizar
      </button>
    </div>
  );
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

const DISMISS_KEY = "etude:install-dismissed";

/** Banner de instalación en Android/escritorio, y ayuda manual en iOS. */
export function InstallBanner() {
  // ClientOnly garantiza que window y localStorage existen al inicializar el estado.
  return (
    <ClientOnly>
      <InstallBannerInner />
    </ClientOnly>
  );
}

function InstallBannerInner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return !!localStorage.getItem(DISMISS_KEY);
    } catch {
      return false;
    }
  });
  // iOS no expone beforeinstallprompt: hay que explicar el gesto de Compartir.
  const [iosHint] = useState(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const isIos = /iphone|ipad|ipod/i.test(nav.userAgent);
    const installed = nav.standalone || window.matchMedia("(display-mode: standalone)").matches;
    return isIos && !installed;
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* sin almacenamiento */
    }
  };

  if (dismissed || (!prompt && !iosHint)) return null;

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setPrompt(null);
    else close();
  };

  return (
    <div className="fixed bottom-28 lg:bottom-4 left-4 right-4 max-w-sm mx-auto bg-surface border border-surface-3 rounded-3xl shadow-lg p-4 flex items-center gap-3 z-50">
      <span className="text-2xl shrink-0" aria-hidden>
        🎹
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">Instalar Opus Piano</p>
        <p className="text-xs text-ink-2">
          {iosHint ? "Pulsa Compartir y luego «Añadir a pantalla de inicio»." : "Úsala sin conexión como una app."}
        </p>
      </div>
      {prompt && (
        <button type="button" onClick={() => void install()} className="pill pill-active text-xs py-1.5 shrink-0">
          Instalar
        </button>
      )}
      <button type="button" onClick={close} className="text-ink-3 text-xs hover:text-ink shrink-0" aria-label="Cerrar">
        ✕
      </button>
    </div>
  );
}
