"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { logout, useAuth } from "@/lib/auth";
import { AuthForm, type AuthMode } from "./auth-form";

/** Mensajes para los códigos con los que vuelve el servidor tras un fallo de Google (`?error=`). */
const OAUTH_ERRORS: Record<string, string> = {
  cancelado: "Has cancelado el acceso.",
  estado: "La sesión de acceso caducó. Vuelve a intentarlo.",
  "correo-existente": "Ese correo ya tiene cuenta con contraseña: entra con ella.",
  proveedor: "No se pudo completar el acceso con Google.",
};

/** Solo rutas internas: evita que `?next=` mande a otro dominio tras entrar. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/api/")) return "/";
  return raw;
}

/**
 * Cuerpo de /login y /register: columna estrecha centrada con el formulario.
 * Al entrar, vuelve a `?next=` (o a la portada). Si ya hay sesión, lo dice
 * en vez de mostrar el formulario.
 */
export function AuthPage({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const { status, user } = useAuth();
  const [done, setDone] = useState(false);
  // Se leen una sola vez; el componente solo se monta en el cliente (ClientOnly).
  const [{ next, oauthError }] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("error");
    return {
      next: safeNext(params.get("next")),
      oauthError: code ? (OAUTH_ERRORS[code] ?? OAUTH_ERRORS.proveedor) : null,
    };
  });

  if (status === "loading" || done) return null;

  if (user) {
    return (
      <div className="mx-auto w-full max-w-[34rem] pt-4 md:pt-10 space-y-6">
        <h1 className="text-3xl md:text-[2.5rem] font-bold tracking-tight leading-tight">Ya has iniciado sesión</h1>
        <p className="text-ink-2">
          Estás dentro como <span className="font-semibold text-ink">{user.name}</span> ({user.email}).
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={next === "/" ? "/account" : next} className="btn-primary h-12 px-6 rounded-[0.875rem]">
            Continuar
          </Link>
          <button type="button" onClick={() => void logout()} className="btn-outline h-12">
            Cerrar sesión y entrar con otra cuenta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[34rem] pt-4 md:pt-10">
      {oauthError && (
        <p role="alert" className="mb-6 text-sm rounded-xl bg-bad-soft px-4 py-3">
          {oauthError}
        </p>
      )}
      <AuthForm
        key={mode}
        initialMode={mode}
        links
        next={next}
        onDone={() => {
          setDone(true);
          router.replace(next);
        }}
      />
    </div>
  );
}
