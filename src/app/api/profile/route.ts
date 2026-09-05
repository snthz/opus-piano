import { prisma } from "@/lib/db";
import { profileFromRequest } from "@/lib/server/auth";
import { newCode } from "@/lib/server/progress-service";

/** Crea un perfil nuevo. El dispositivo guarda el id devuelto. */
export async function POST() {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const p = await prisma.profile.create({ data: { code: newCode() }, select: { id: true, code: true } });
      return Response.json(p, { status: 201 });
    } catch {
      // Colisión de código (muy improbable): se vuelve a intentar con otro.
    }
  }
  return Response.json({ error: "No se pudo crear el perfil" }, { status: 500 });
}

/**
 * Sin parámetros: el perfil de la cabecera. Con `?code=`: el perfil que tiene
 * ese código, para vincular otro dispositivo.
 */
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code");
  if (code) {
    const p = await prisma.profile.findUnique({ where: { code: code.trim().toUpperCase() }, select: { id: true, code: true } });
    return p ? Response.json(p) : Response.json({ error: "Código no encontrado" }, { status: 404 });
  }
  const me = await profileFromRequest(req);
  return me ? Response.json(me) : Response.json({ error: "Perfil no válido" }, { status: 401 });
}
