"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { openAuthModal } from "@/lib/auth-modal";

const DISMISS_KEY = "etude:nudge-dismissed";
const DISMISS_MS = 24 * 60 * 60 * 1000;

function dismissed(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(DISMISS_KEY) ?? 0) < DISMISS_MS;
  } catch {
    return false;
  }
}

/**
 * Aviso para crear cuenta cuando alguien usa la app sin sesión: aparece cuando
 * `when` pasa a true (p. ej. tras varias respuestas o al añadir una partitura)
 * y, si lo cierra, no vuelve a salir en 24 h.
 */
export function SignupNudge({ when, title, text }: { when: boolean; title: string; text: string }) {
  const { status, user } = useAuth();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const shown = useRef(false);

  useEffect(() => {
    if (!when || shown.current || status !== "anonymous" || user || dismissed()) return;
    shown.current = true;
    setOpen(true);
  }, [when, status, user]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const close = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* sin almacenamiento */
    }
    setOpen(false);
  };

  return (
    <dialog ref={ref} onClose={close} onClick={(e) => e.target === e.currentTarget && close()} aria-labelledby="nudge-title" className="modal w-[min(100%-2rem,24rem)]">
      <div className="p-6 space-y-4">
        <div className="w-12 h-12 rounded-full bg-lavender grid place-items-center text-2xl" aria-hidden>
          🎹
        </div>
        <div>
          <h2 id="nudge-title" className="text-xl font-bold tracking-tight">{title}</h2>
          <p className="text-ink-2 mt-1 text-sm leading-relaxed">{text}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              openAuthModal("register");
            }}
            className="btn-primary flex-1"
          >
            Crear cuenta
          </button>
          <button type="button" onClick={() => { setOpen(false); openAuthModal("login"); }} className="btn-secondary">
            Ya tengo una
          </button>
        </div>
        <button type="button" onClick={close} className="text-xs text-ink-3 hover:text-ink">
          Ahora no
        </button>
      </div>
    </dialog>
  );
}
