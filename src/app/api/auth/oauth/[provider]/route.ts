import type { NextRequest } from "next/server";
import { authorizationUrl, enabledProviders, isProvider, safeReturnTo } from "@/lib/server/oauth";

/** Inicio del flujo: guarda el estado en una cookie y manda al proveedor. `?next=/ruta` para volver. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  if (!isProvider(provider) || !enabledProviders()[provider]) {
    return Response.json({ error: "Proveedor no disponible" }, { status: 404 });
  }
  const returnTo = safeReturnTo(req.nextUrl.searchParams.get("next"));
  const { url, cookie } = authorizationUrl(req, returnTo);
  return new Response(null, { status: 302, headers: { Location: url.toString(), "Set-Cookie": cookie } });
}
