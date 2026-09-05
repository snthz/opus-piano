"use client";

import { useEffect, useState } from "react";
import { fetchProviders, login, register, type Providers } from "@/lib/auth";
import { PASSWORD_MIN, firstIssue, loginSchema, registerSchema } from "@/lib/validation";

type Mode = "login" | "register";

/**
 * Tarjeta de acceso: botón de Google arriba (solo si el servidor tiene credenciales),
 * separador, y el formulario de correo y contraseña. Un mismo componente sirve
 * para entrar y para crear cuenta.
 */
export function AuthForm({ initialMode = "login", onDone }: { initialMode?: Mode; onDone?: () => void }) {
  const [mode, setMode] = useState<Mode>(initialMode);
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

  const switchMode = (m: Mode) => {
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
  const next = typeof window !== "undefined" ? encodeURIComponent(window.location.pathname) : "%2F";

  return (
    <div className="p-6 md:p-8 space-y-6">
      <header>
        <h2 className="text-2xl font-bold tracking-tight pr-10">{mode === "login" ? "Hola de nuevo" : "Crea tu cuenta"}</h2>
        <p className="text-ink-2 mt-1">
          {mode === "login" ? "Entra para guardar tu progreso en todos tus dispositivos." : "Tu progreso te seguirá a cualquier dispositivo."}
        </p>
      </header>

      {social && (
        <>
          <a href={`/api/auth/oauth/google?next=${next}`} className={socialClass}>
            <GoogleLogo />
            {mode === "login" ? "Entrar con Google" : "Continuar con Google"}
          </a>
          <div className="flex items-center gap-4 text-xs font-medium text-ink-3" aria-hidden>
            <span className="h-px flex-1 bg-line" />
            O
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-4"
      >
        {mode === "register" && (
          <Field label="Nombre">
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} className={inputClass} />
          </Field>
        )}
        <Field label="Correo">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            placeholder="hola@ejemplo.com"
            className={inputClass}
          />
        </Field>
        <Field label="Contraseña" hint={mode === "register" ? `Mínimo ${PASSWORD_MIN} caracteres.` : undefined}>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              className={`${inputClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 grid place-items-center rounded-full text-ink-3 hover:text-ink hover:bg-surface-3"
            >
              <EyeIcon off={showPassword} />
            </button>
          </div>
        </Field>

        {error && (
          <p role="alert" className="text-sm rounded-2xl bg-bad-soft px-4 py-2.5">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Un momento…" : mode === "register" ? "Crear cuenta" : "Entrar"}
        </button>
      </form>

      <p className="text-sm text-ink-2">
        {mode === "login" ? (
          <>
            ¿No tienes cuenta?{" "}
            <button type="button" onClick={() => switchMode("register")} className="font-semibold text-ink hover:underline">
              Regístrate
            </button>
          </>
        ) : (
          <>
            ¿Ya tienes cuenta?{" "}
            <button type="button" onClick={() => switchMode("login")} className="font-semibold text-ink hover:underline">
              Entra
            </button>
          </>
        )}
      </p>
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl px-4 py-3 text-sm bg-surface-2 placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent";

const socialClass =
  "btn-secondary w-full";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5" aria-hidden>
      <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 20 20 4" strokeLinecap="round" />}
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l3.9-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l3.9 3.1c1-2.9 3.6-5 6.7-5z" />
    </svg>
  );
}
