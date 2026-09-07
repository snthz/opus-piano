"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchProviders, login, register, type Providers } from "@/lib/auth";
import { PASSWORD_MIN, firstIssue, loginSchema, registerSchema } from "@/lib/validation";

export type AuthMode = "login" | "register";

/**
 * Formulario de acceso: título grande, enlace para cambiar entre entrar y
 * registrarse, botón de Google (solo si el servidor tiene credenciales),
 * separador «o» y los campos de correo y contraseña con etiqueta encima.
 *
 * Sirve tanto en la página /login como en el modal. Con `links` el cambio de
 * modo son enlaces a /login y /register (la página se encarga de remontar);
 * sin él, cambia de modo en el sitio.
 */
export function AuthForm({
  initialMode = "login",
  onDone,
  next,
  links = false,
  className = "",
}: {
  initialMode?: AuthMode;
  onDone?: () => void;
  /** A dónde volver tras entrar con Google. Por defecto, la ruta actual. */
  next?: string;
  links?: boolean;
  className?: string;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState<Providers | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchProviders().then((p) => alive && setProviders(p));
    return () => {
      alive = false;
    };
  }, []);

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setError(null);
  };

  const submit = async () => {
    setError(null);
    // Misma validación que el servidor, para avisar sin esperar a la red.
    const parsed = mode === "register" ? registerSchema.safeParse({ name, email, password }) : loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(firstIssue(parsed));
      return;
    }
    setBusy(true);
    try {
      if (mode === "register") await register(parsed.data as { name: string; email: string; password: string });
      else await login(parsed.data);
      setPassword("");
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo ha fallado.");
    } finally {
      setBusy(false);
    }
  };

  const social = !!providers?.google;
  const returnTo = encodeURIComponent(next ?? (typeof window !== "undefined" ? window.location.pathname : "/"));
  const nextQuery = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  const isLogin = mode === "login";
  const Heading = links ? "h1" : "h2";

  return (
    <div className={`space-y-6 ${className}`}>
      <header className="space-y-3">
        <Heading className={`text-3xl font-bold tracking-tight leading-tight pr-10 ${links ? "md:text-[2.5rem]" : ""}`}>
          {isLogin ? "Iniciar sesión" : "Crear cuenta"}
        </Heading>
        <p className="text-ink-2">
          {isLogin ? "¿Todavía no tienes cuenta? " : "¿Ya tienes cuenta? "}
          {links ? (
            <Link href={isLogin ? `/register${nextQuery}` : `/login${nextQuery}`} className="font-medium text-ink underline underline-offset-4 hover:text-ink-2">
              {isLogin ? "Regístrate gratis" : "Inicia sesión"}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => switchMode(isLogin ? "register" : "login")}
              className="font-medium text-ink underline underline-offset-4 hover:text-ink-2"
            >
              {isLogin ? "Regístrate gratis" : "Inicia sesión"}
            </button>
          )}
        </p>
      </header>

      {social && (
        <>
          <a href={`/api/auth/oauth/google?next=${returnTo}`} className="btn-outline w-full h-14 text-base">
            <GoogleLogo />
            Continuar con Google
          </a>
          <div className="flex items-center gap-4 text-sm font-semibold text-ink-2" aria-hidden>
            <span className="h-px flex-1 bg-line" />
            o
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-5"
      >
        {!isLogin && (
          <Field label="Nombre">
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} placeholder="Tu nombre" className="field" />
          </Field>
        )}
        <Field label="Correo electrónico">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            placeholder="Tu correo electrónico"
            className="field"
          />
        </Field>
        <Field label="Contraseña" hint={isLogin ? undefined : `Mínimo ${PASSWORD_MIN} caracteres.`}>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isLogin ? "current-password" : "new-password"}
              placeholder="Tu contraseña"
              className="field pr-14"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-lg text-ink hover:bg-surface-2"
            >
              <EyeIcon off={showPassword} />
            </button>
          </div>
        </Field>

        {error && (
          <p role="alert" className="text-sm rounded-xl bg-bad-soft px-4 py-3">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full h-14 text-base rounded-[0.875rem]">
          {busy ? "Un momento…" : isLogin ? "Iniciar sesión" : "Crear cuenta"}
        </button>
      </form>

      {!isLogin && (
        <p className="text-xs text-ink-3 leading-relaxed">
          Tu progreso se guarda en el servidor y aparece igual en el móvil y en el ordenador. Puedes borrar la cuenta cuando quieras.
        </p>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="block text-[15px] text-ink">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6" aria-hidden>
      <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 20 20 4" strokeLinecap="round" />}
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l3.9-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l3.9 3.1c1-2.9 3.6-5 6.7-5z" />
    </svg>
  );
}
