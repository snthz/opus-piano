"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteAccount, logout, useAuth } from "@/lib/auth";
import { useProgress, useSyncState, summarize, dayStreak, syncProgress } from "@/lib/progress";

/** Página «Cuenta»: formulario si no hay sesión; datos, sincronización y cierre si la hay. */
export function AccountPanel() {
  const auth = useAuth();
  if (auth.status === "loading") return null;
  if (!auth.user) return <Anonymous />;
  return <SignedIn />;
}

function Anonymous() {
  return (
    <div className="card p-6 sm:p-7 space-y-5">
      <div className="flex items-start gap-4">
        <span className="w-12 h-12 rounded-2xl bg-surface-2 border border-line grid place-items-center text-ink-2 shrink-0" aria-hidden>
          <UserIcon />
        </span>
        <div className="space-y-1">
          <h2 className="font-bold tracking-tight">Sin sesión iniciada</h2>
          <p className="text-sm text-ink-2 leading-relaxed">
            Lo que practiques se guarda en este dispositivo y, al entrar, se suma a tu cuenta.
          </p>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Link href="/login" className="btn-primary h-11 px-5 rounded-full text-sm">
          Iniciar sesión
        </Link>
        <Link href="/register" className="btn-quiet h-11 px-5">
          Crear cuenta
        </Link>
      </div>
    </div>
  );
}

function SignedIn() {
  const { user } = useAuth();
  const sync = useSyncState();
  const progress = useProgress();
  const totals = summarize(progress);
  const streak = dayStreak(progress);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const status = sync.busy
    ? "Sincronizando…"
    : sync.error
      ? `Sin sincronizar (${sync.error})${sync.pending ? ` · ${sync.pending} pendientes` : ""}`
      : sync.lastSync
        ? `Sincronizado el ${new Date(sync.lastSync).toLocaleString("es")}`
        : "Todavía no se ha sincronizado.";
  const dot = sync.busy ? "bg-ink-3 animate-pulse" : sync.error ? "bg-bad" : sync.lastSync ? "bg-ok" : "bg-ink-3";

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(user.hasPassword ? password : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo borrar la cuenta.");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden">
        <div className="p-6 sm:p-7 flex items-center gap-4">
          <span
            className="w-16 h-16 rounded-full bg-accent text-bg grid place-items-center text-xl font-bold tracking-tight shrink-0"
            aria-hidden
          >
            {initials(user.name)}
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-lg font-bold tracking-tight truncate">{user.name}</p>
            <p className="text-sm text-ink-2 truncate">{user.email}</p>
            <p className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs text-ink-2">
              <CalendarIcon />
              Desde {new Date(user.createdAt).toLocaleDateString("es")}
            </p>
          </div>
        </div>

        {/* Rejilla con líneas finas: `gap-px` sobre el color de línea dibuja las separaciones. */}
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line border-y border-line">
          <Stat label="Respuestas" value={String(totals.attempts)} />
          <Stat label="Aciertos" value={`${totals.accuracy}%`} />
          <Stat label="Días" value={String(totals.days)} />
          <Stat label="Racha" value={String(streak)} />
        </dl>

        <div className="flex items-center justify-between gap-3 flex-wrap px-6 sm:px-7 py-4">
          <p className="flex items-center gap-2 text-xs text-ink-2 min-w-0">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} aria-hidden />
            <span className="truncate">{status}</span>
          </p>
          <button type="button" onClick={() => void syncProgress()} disabled={sync.busy} className="btn-quiet h-9 px-3.5 text-xs">
            <SyncIcon />
            Sincronizar ahora
          </button>
        </div>
      </section>

      <section className="card divide-y divide-line">
        <Row
          icon={<LogoutIcon />}
          title="Sesión"
          text="Al cerrar sesión se quitan de este dispositivo el progreso y las partituras que ya están en tu cuenta; allí siguen guardados."
          action={
            <button type="button" onClick={() => void logout()} className="btn-quiet">
              Cerrar sesión
            </button>
          }
        />
        <Row
          tone="bad"
          icon={<TrashIcon />}
          title="Borrar cuenta"
          text="Elimina la cuenta y todo su progreso en el servidor. No se puede deshacer."
          action={
            confirmDelete ? null : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="btn-danger">
                Borrar mi cuenta…
              </button>
            )
          }
        >
          {confirmDelete && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void remove();
              }}
              className="mt-4 space-y-3 rounded-2xl border border-bad/40 bg-bad-soft p-4"
            >
              {user.hasPassword ? (
                <label className="block text-sm font-medium">
                  Escribe tu contraseña para confirmar
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className="mt-1.5 w-full rounded-full border border-line bg-surface px-4 py-2.5 text-sm focus:outline-none focus:border-bad focus:ring-2 focus:ring-bad/25"
                  />
                </label>
              ) : (
                <p className="text-sm font-medium">¿Seguro? Se borrará la cuenta vinculada a {user.email}.</p>
              )}
              {error && <p role="alert" className="text-sm font-medium">{error}</p>}
              <div className="flex gap-2 flex-wrap">
                <button type="submit" disabled={busy || (user.hasPassword && !password)} className="btn-danger-solid h-9 px-3.5 text-xs">
                  Borrar definitivamente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDelete(false);
                    setPassword("");
                    setError(null);
                  }}
                  className="btn-quiet h-9 px-3.5 text-xs"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </Row>
      </section>
    </div>
  );
}

/** Fila de ajustes: icono, texto y acción a la derecha (debajo en móvil). */
function Row({
  icon,
  title,
  text,
  action,
  tone = "neutral",
  children,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
  tone?: "neutral" | "bad";
  children?: React.ReactNode;
}) {
  return (
    <div className="p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <span
          className={`w-10 h-10 rounded-2xl grid place-items-center shrink-0 border ${
            tone === "bad" ? "bg-bad-soft border-bad/30 text-bad" : "bg-surface-2 border-line text-ink-2"
          }`}
          aria-hidden
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-ink-2 leading-relaxed">{text}</p>
        </div>
        {action && <div className="hidden sm:block shrink-0">{action}</div>}
      </div>
      {action && <div className="sm:hidden mt-4">{action}</div>}
      {children}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-4 text-center">
      <dd className="text-2xl font-bold tabular-nums tracking-tight">{value}</dd>
      <dt className="mt-0.5 text-[0.6875rem] uppercase tracking-wide text-ink-3">{label}</dt>
    </div>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8 3.5v3M16 3.5v3" strokeLinecap="round" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5" aria-hidden="true">
      <path d="M20 12a8 8 0 0 1-13.7 5.6M4 12a8 8 0 0 1 13.7-5.6" strokeLinecap="round" />
      <path d="M17.5 3v3.5H14M6.5 21v-3.5H10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5" aria-hidden="true">
      <path d="M15 4.5H18a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3" strokeLinecap="round" />
      <path d="M11 8.5 14.5 12 11 15.5M14 12H4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5" aria-hidden="true">
      <path d="M4.5 7h15M9.5 7V5.5a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5V7" strokeLinecap="round" />
      <path d="M6.5 7l.8 11.2A2 2 0 0 0 9.3 20h5.4a2 2 0 0 0 2-1.8L17.5 7" strokeLinecap="round" />
      <path d="M10.5 11v5M13.5 11v5" strokeLinecap="round" />
    </svg>
  );
}
