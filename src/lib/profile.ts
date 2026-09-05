"use client";

/**
 * Identidad del dispositivo frente al servidor: un id de perfil guardado en
 * localStorage. Sin contraseñas; para usar el mismo perfil en otro dispositivo
 * se introduce el código corto del perfil.
 */

const KEY = "etude:profile";

export interface Profile {
  id: string;
  code: string;
}

export function getProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

function setProfile(p: Profile | null) {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
  } catch {
    /* sin almacenamiento */
  }
}

/** fetch a la API propia con la cabecera del perfil. */
export async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const p = getProfile();
  const headers = new Headers(init.headers);
  if (p) headers.set("x-profile-id", p.id);
  return fetch(path, { ...init, headers, cache: "no-store" });
}

/** Devuelve el perfil del dispositivo, creándolo en el servidor si aún no hay. */
export async function ensureProfile(): Promise<Profile | null> {
  const existing = getProfile();
  if (existing) return existing;
  const res = await fetch("/api/profile", { method: "POST" });
  if (!res.ok) return null;
  const p = (await res.json()) as Profile;
  setProfile(p);
  return p;
}

/** Cambia este dispositivo al perfil que tiene el código dado. */
export async function linkProfile(code: string): Promise<Profile> {
  const res = await fetch(`/api/profile?code=${encodeURIComponent(code.trim().toUpperCase())}`);
  if (res.status === 404) throw new Error("No existe ningún perfil con ese código.");
  if (!res.ok) throw new Error("No se pudo comprobar el código.");
  const p = (await res.json()) as Profile;
  setProfile(p);
  return p;
}

export function forgetProfile() {
  setProfile(null);
}
