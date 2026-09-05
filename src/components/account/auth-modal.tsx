"use client";

import { useEffect, useRef } from "react";
import { closeAuthModal, useAuthModal } from "@/lib/auth-modal";
import { AuthForm } from "./auth-form";

/**
 * Modal de inicio de sesión / registro. Se monta una vez en el layout y se abre
 * con `openAuthModal()`. Usa <dialog>, así el foco, Escape y el fondo los
 * gestiona el navegador.
 */
export function AuthModal() {
  const mode = useAuthModal();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (mode && !dialog.open) dialog.showModal();
    if (!mode && dialog.open) dialog.close();
  }, [mode]);

  return (
    <dialog
      ref={ref}
      onClose={closeAuthModal}
      onClick={(e) => {
        // Clic en el fondo (fuera de la tarjeta): cerrar.
        if (e.target === e.currentTarget) closeAuthModal();
      }}
      aria-label="Acceso a tu cuenta"
      className="modal w-[min(100%-2rem,26rem)]"
    >
      {mode && (
        <>
          <button
            type="button"
            onClick={closeAuthModal}
            aria-label="Cerrar"
            className="absolute top-4 right-4 w-9 h-9 rounded-full text-ink-3 hover:text-ink hover:bg-surface-2 grid place-items-center transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
          <AuthForm key={mode} initialMode={mode} onDone={closeAuthModal} />
        </>
      )}
    </dialog>
  );
}
