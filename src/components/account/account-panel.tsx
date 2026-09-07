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
    <div className="card p-5 space-y-4">
      <p className="text-sm text-ink-2">
        Todavía no has iniciado sesión. Lo que practiques se guarda en este dispositivo y, al entrar, se suma a tu cuenta.
      </p>
      <div className="flex gap-2 flex-wrap">
        <Link href="/login" className="btn-primary h-11 px-5 rounded-[0.875rem] text-sm">
          Iniciar sesión
        </Link>
        <Link href="/register" className="btn-outline h-11 text-sm">
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
        ? `Última sincronización: ${new Date(sync.lastSync).toLocaleString("es")}`
        : "Todavía no se ha sincronizado.";

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
      <section className="card p-5 space-y-3">
        <div className="flex items-center gap-4">
          <span className="w-14 h-14 rounded-full bg-lavender grid place-items-center text-xl font-bold shrink-0" aria-hidden>
            {initials(user.name)}
          </span>
          <div className="min-w-0">
            <p className="font-bold truncate">{user.name}</p>
            <p className="text-sm text-ink-2 truncate">{user.email}</p>
            <p className="text-xs text-ink-3">Desde {new Date(user.createdAt).toLocaleDateString("es")}</p>
          </div>
        </div>
        <dl className="grid grid-cols-4 gap-2 text-center">
          <Stat label="Respuestas" value={String(totals.attempts)} />
          <Stat label="Aciertos" value={`${totals.accuracy}%`} />
          <Stat label="Días" value={String(totals.days)} />
          <Stat label="Racha" value={String(streak)} />
        </dl>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-ink-3">{status}</p>
          <button type="button" onClick={() => void syncProgress()} disabled={sync.busy} className="pill text-xs py-1.5 disabled:opacity-40">
            Sincronizar ahora
          </button>
        </div>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-bold">Sesión</h2>
        <p className="text-sm text-ink-2">
          Al cerrar sesión se quitan de este dispositivo el progreso y las partituras que ya están en tu cuenta; allí siguen guardados.
        </p>
        <button type="button" onClick={() => void logout()} className="pill text-sm">
          Cerrar sesión
        </button>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-bold">Borrar cuenta</h2>
        <p className="text-sm text-ink-2">Elimina la cuenta y todo su progreso en el servidor. No se puede deshacer.</p>
        {confirmDelete ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void remove();
            }}
            className="space-y-2 rounded-2xl bg-bad-soft p-4"
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
                  className="mt-1 w-full rounded-2xl px-4 py-2.5 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-bad"
                />
              </label>
            ) : (
              <p className="text-sm font-medium">¿Seguro? Se borrará la cuenta vinculada a {user.email}.</p>
            )}
            {error && <p role="alert" className="text-sm">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={busy || (user.hasPassword && !password)} className="pill text-xs py-1.5 bg-bad text-bg disabled:opacity-50">
                Borrar definitivamente
              </button>
              <button type="button" onClick={() => { setConfirmDelete(false); setPassword(""); setError(null); }} className="pill text-xs py-1.5">
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="pill text-sm hover:bg-bad-soft">
            Borrar mi cuenta…
          </button>
        )}
      </section>
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
    <div className="rounded-2xl bg-surface-2 py-3">
      <dd className="text-lg font-bold tabular-nums">{value}</dd>
      <dt className="text-xs text-ink-2">{label}</dt>
    </div>
  );
}
