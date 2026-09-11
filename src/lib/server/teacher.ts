import { streamAnswer, type UsageSink } from "@/lib/server/study-plan";
import { teacherInstructions, type TeacherRequest } from "@/lib/teacher";

/**
 * El profesor general, del lado del servidor. Todo lo que cuesta —el cliente,
 * el streaming, la traducción de errores y el recibo del gasto— ya está en
 * `study-plan.ts`; aquí solo se decide qué se le cuenta al modelo.
 */
export function askGeneralTeacher(req: TeacherRequest, signal?: AbortSignal, onUsage?: UsageSink): AsyncGenerator<string> {
  return streamAnswer(teacherInstructions(req.naming, req.level), req.history, signal, onUsage);
}
