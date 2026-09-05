import { unauthorized, userFromRequest } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/user-json";

/** Usuario de la sesión actual. Se llama al arrancar la app. */
export async function GET(req: Request) {
  const me = await userFromRequest(req);
  if (!me) return unauthorized();
  return Response.json(publicUser(me), { headers: { "Cache-Control": "no-store" } });
}
