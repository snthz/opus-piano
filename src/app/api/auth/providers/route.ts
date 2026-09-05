// Se evalúa en cada petición (no en el build): las credenciales llegan por entorno en el VPS.
export const dynamic = "force-dynamic";

import { enabledProviders } from "@/lib/server/oauth";

/** Qué botones sociales mostrar. Depende solo de las variables de entorno. */
export function GET() {
  return Response.json(enabledProviders(), { headers: { "Cache-Control": "public, max-age=300" } });
}
