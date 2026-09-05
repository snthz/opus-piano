"use client";

import { useSyncExternalStore } from "react";

/**
 * Sesión del usuario en el cliente. La cookie HttpOnly la gestiona el servidor;
 * aquí solo se guarda quién es el usuario para pintar la interfaz al instante
 * (también sin conexión) y avisar al resto de la app cuando cambia.
 */
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  /** false si la cuenta entró con Google y no tiene contraseña */
  hasPassword: boolean;
}

export type Providers = { google: boolean };

/** Qué botones sociales mostrar (solo si el servidor tiene credenciales). Sin red, ninguno. */
export async function fetchProviders(): Promise<Providers> {
  try {
    const res = await fetch("/api/auth/providers");
    if (!res.ok) throw new Error();
    return (await res.json()) as Providers;
  } catch {
    return { google: false };
  }
}

export type AuthStatus = "loading" | "anonymous" | "signed-in";

export interface AuthState {
  status: AuthStatus;
  user: User | null;
}

const KEY = "etude:user";
const SERVER_STATE: AuthState = { status: "loading", user: null };

let state: AuthState | null = null;
const listeners = new Set<() => void>();
const authListeners = new Set<(user: User | null) => void>();

function read(): AuthState {
  if (state) return state;
  if (typeof window === "undefined") return SERVER_STATE;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? { status: "signed-in", user: JSON.parse(raw) as User } : { status: "anonymous", user: null };
  } catch {
    state = { status: "anonymous", user: null };
  }
  return state;
}

function set(next: AuthState) {
  const before = state?.user?.id ?? null;
  state = next;
  try {
    if (next.user) localStorage.setItem(KEY, JSON.stringify(next.user));
    else localStorage.removeItem(KEY);
  } catch {
    /* sin almacenamiento */
  }
  listeners.forEach((l) => l());
  if ((next.user?.id ?? null) !== before) authListeners.forEach((l) => l(next.user));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getUser(): User | null {
  return read().user;
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, read, () => SERVER_STATE);
}

/** Avisa cuando el usuario cambia (inicio o cierre de sesión). Devuelve la función para desuscribirse. */
export function onAuthChange(listener: (user: User | null) => void) {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

export class AuthError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function post(path: string, body?: unknown): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
}

async function fail(res: Response, fallback: string): Promise<never> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new AuthError(data?.error ?? fallback, res.status);
}

/** Pregunta al servidor quién es el usuario. Sin red se conserva lo que había. */
export async function refreshUser(): Promise<User | null> {
  let res: Response;
  try {
    res = await fetch("/api/auth/me", { cache: "no-store" });
  } catch {
    return read().user;
  }
  if (res.status === 401) {
    set({ status: "anonymous", user: null });
    return null;
  }
  if (!res.ok) return read().user;
  const user = (await res.json()) as User;
  set({ status: "signed-in", user });
  return user;
}

export async function register(input: { name: string; email: string; password: string }): Promise<User> {
  const res = await post("/api/auth/register", input).catch(() => null);
  if (!res) throw new AuthError("No hay conexión con el servidor.", 0);
  if (!res.ok) await fail(res, "No se pudo crear la cuenta.");
  const user = (await res.json()) as User;
  set({ status: "signed-in", user });
  return user;
}

export async function login(input: { email: string; password: string }): Promise<User> {
  const res = await post("/api/auth/login", input).catch(() => null);
  if (!res) throw new AuthError("No hay conexión con el servidor.", 0);
  if (!res.ok) await fail(res, "No se pudo iniciar sesión.");
  const user = (await res.json()) as User;
  set({ status: "signed-in", user });
  return user;
}

export async function logout(): Promise<void> {
  await post("/api/auth/logout").catch(() => null);
  set({ status: "anonymous", user: null });
}

export async function deleteAccount(password?: string): Promise<void> {
  const res = await fetch("/api/auth/account", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  }).catch(() => null);
  if (!res) throw new AuthError("No hay conexión con el servidor.", 0);
  if (!res.ok) await fail(res, "No se pudo borrar la cuenta.");
  set({ status: "anonymous", user: null });
}
