import { prisma } from "@/lib/db";

/**
 * Identifica el perfil por la cabecera `x-profile-id` que envía el cliente.
 * No hay contraseñas: la app es personal y el id es una cadena aleatoria larga
 * que solo conoce el dispositivo (y quien tenga su código de vinculación).
 */
export async function profileFromRequest(req: Request): Promise<{ id: string; code: string } | null> {
  const id = req.headers.get("x-profile-id");
  if (!id || !/^[a-z0-9]{10,40}$/.test(id)) return null;
  return prisma.profile.findUnique({ where: { id }, select: { id: true, code: true } });
}

export const unauthorized = () => Response.json({ error: "Perfil no válido" }, { status: 401 });
