"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Recorrido (px) o velocidad (px/ms) de arrastre hacia abajo a partir de los que la hoja se cierra. */
const DISMISS_DISTANCE = 120;
const DISMISS_SPEED = 0.6;

/**
 * Hoja que sube desde el borde inferior y deja ver, atenuado, lo que hay debajo.
 * Es un `<dialog>`, así que el foco, Escape y el fondo los gestiona el navegador;
 * además se cierra tocando el fondo o arrastrando la cabecera hacia abajo. El
 * contenido se desplaza dentro de la hoja, con la cabecera siempre a la vista.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  actions,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  /** Botones a la derecha de la cabecera, antes del de cerrar */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ y: number; t: number; id: number } | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  /* Arrastre de la cabecera: la hoja sigue al dedo (solo hacia abajo) y al
     soltar, o vuelve a su sitio o se cierra si se ha bajado bastante o rápido. */
  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Sobre un botón (la X, las acciones) no hay gesto: capturar el puntero
    // aquí se quedaría con el `click` y el botón nunca lo recibiría.
    if ((e.target as HTMLElement).closest("button, a, input, select, textarea, [role='button']")) return;
    drag.current = { y: e.clientY, t: performance.now(), id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el || d.id !== e.pointerId) return;
    el.style.transition = "none";
    el.style.transform = `translateY(${Math.max(0, e.clientY - d.y)}px)`;
  };
  const onPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el || d.id !== e.pointerId) return;
    drag.current = null;
    const dy = Math.max(0, e.clientY - d.y);
    const speed = dy / Math.max(1, performance.now() - d.t);
    el.style.transition = "";
    el.style.transform = "";
    if (dy > DISMISS_DISTANCE || (dy > 24 && speed > DISMISS_SPEED)) onClose();
  };

  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === e.currentTarget && onClose()} aria-label={title} className="sheet">
      {/* Un único hijo en columna: la cabecera fija y el contenido que se desplaza. */}
      {open && (
        <div>
          <header
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="shrink-0 px-5 pt-2.5 pb-3 select-none [touch-action:none] cursor-grab active:cursor-grabbing"
          >
            <span className="block w-10 h-1.5 rounded-full bg-surface-3 mx-auto mb-3" aria-hidden />
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-lg leading-tight truncate">{title}</h2>
                {subtitle && <p className="text-xs text-ink-2 truncate mt-0.5">{subtitle}</p>}
              </div>
              {actions}
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="shrink-0 w-9 h-9 rounded-full text-ink-3 hover:text-ink hover:bg-surface-2 grid place-items-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ink/25"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </header>
          <div
            className="min-h-0 flex-1 overflow-y-auto px-4 pt-1 overscroll-contain"
            style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
          >
            {children}
          </div>
        </div>
      )}
    </dialog>
  );
}
