import { profileFromRequest, unauthorized } from "@/lib/server/auth";
import { applyAnswers, isAnswer, progressMap } from "@/lib/server/progress-service";

/** Recibe un lote de respuestas (la cola del dispositivo) y devuelve el progreso actualizado. */
export async function POST(req: Request) {
  const me = await profileFromRequest(req);
  if (!me) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON no válido" }, { status: 400 });
  }
  const answers = (body as { answers?: unknown })?.answers;
  if (!Array.isArray(answers) || answers.length > 500 || !answers.every(isAnswer)) {
    return Response.json({ error: "Respuestas no válidas" }, { status: 400 });
  }

  if (answers.length) await applyAnswers(me.id, answers);
  return Response.json(await progressMap(me.id));
}
