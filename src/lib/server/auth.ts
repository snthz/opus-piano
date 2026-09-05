import { userFromRequest } from "@/lib/server/session";

export { userFromRequest };

export const unauthorized = () => Response.json({ error: "Inicia sesión para continuar" }, { status: 401 });

/**
 * Defensa CSRF sencilla: las peticiones que cambian datos deben venir del propio
 * origen. La cookie es SameSite=Lax, así que esto solo añade una segunda barrera.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // fetch del mismo origen sin cabecera (p. ej. navegadores antiguos) o llamadas de test
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
