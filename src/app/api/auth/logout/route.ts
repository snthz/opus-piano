import { sameOrigin } from "@/lib/server/auth";
import { clearedCookie, destroySession } from "@/lib/server/session";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  await destroySession(req);
  return new Response(null, { status: 204, headers: { "Set-Cookie": clearedCookie() } });
}
