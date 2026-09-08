"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Diálogo modal con el aspecto del sistema de diseño. Por dentro es un
 * `<dialog>`, así que el foco atrapado, Escape y el fondo difuminado los pone
 * el navegador; el clic en el fondo cierra. La cabecera se queda fija cuando el
 * contenido es largo y hay que desplazarlo.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  className = "w-[min(100%-2rem,32rem)]",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Segunda línea de la cabecera: de qué va este diálogo en concreto */
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label={title}
      className={`modal ${className}`}
    >
      {/* Un único hijo: globals.css le da el desplazamiento y las esquinas. */}
      {open && (
        <div>
          <header className="sticky top-0 z-10 flex items-start gap-3 bg-surface px-6 pt-6 pb-3">
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-lg leading-tight">{title}</h2>
              {subtitle && <p className="text-xs text-ink-2 truncate mt-0.5">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="shrink-0 w-9 h-9 rounded-full text-ink-3 hover:text-ink hover:bg-surface-2 grid place-items-center transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </header>
          <div className="px-6 pb-6 space-y-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
