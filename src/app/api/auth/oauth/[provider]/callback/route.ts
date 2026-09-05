import type { NextRequest } from "next/server";
import { clearedStateCookie, enabledProviders, exchangeCode, findOrCreateOAuthUser, isProvider, readState } from "@/lib/server/oauth";
import { createSession, sessionCookie } from "@/lib/server/session";

function redirect(to: string, cookies: string[]): Response {
  const headers = new Headers({ Location: to });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 303, headers });
}

const failed = (reason: string) => redirect(`/account?error=${encodeURIComponent(reason)}`, [clearedStateCookie()]);

/** Google vuelve aquí con `code` y `state`; se comprueba el estado, se canjea el código y se abre sesión. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  if (!isProvider(provider) || !enabledProviders()[provider]) return failed("proveedor");

  const p = req.nextUrl.searchParams;
  const error = p.get("error");
  if (error) return failed(error === "access_denied" ? "cancelado" : "proveedor");

  const saved = readState(req);
  const code = p.get("code");
  const state = p.get("state");
  if (!saved || !code || !state || state !== saved.state) return failed("estado");

  try {
    const identity = await exchangeCode(req, code, saved);
    const user = await findOrCreateOAuthUser(identity);
    const { token, expiresAt } = await createSession(user.id, req.headers.get("user-agent"));
    return redirect(saved.returnTo, [clearedStateCookie(), sessionCookie(token, expiresAt)]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return failed(msg.includes("ya tiene cuenta") ? "correo-existente" : "proveedor");
  }
}
