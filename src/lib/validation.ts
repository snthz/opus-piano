import { z } from "zod";

/**
 * Esquemas de los formularios de cuenta, compartidos entre el cliente (para
 * avisar antes de enviar) y las rutas de la API (que nunca se fían del cliente).
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;
export const NAME_MAX = 60;

export const emailSchema = z
  .string({ error: "El correo no es válido." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "El correo no es válido." }).max(254, { error: "El correo es demasiado largo." }));

export const nameSchema = z
  .string({ error: "Escribe tu nombre." })
  .transform((n) => n.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(1, { error: "Escribe tu nombre." })
      .max(NAME_MAX, { error: `El nombre puede tener hasta ${NAME_MAX} caracteres.` }),
  );

export const passwordSchema = z
  .string({ error: "Falta la contraseña." })
  .min(PASSWORD_MIN, { error: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.` })
  .max(PASSWORD_MAX, { error: "La contraseña es demasiado larga." });

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  // Al entrar no se juzga la longitud: solo se compara con el hash.
  password: z.string({ error: "Falta la contraseña." }).min(1, { error: "Falta la contraseña." }).max(PASSWORD_MAX),
});

/** Borrar cuenta: la contraseña solo se exige si la cuenta tiene una (con Google puede no tenerla). */
export const deleteAccountSchema = z.object({
  password: z.string().max(PASSWORD_MAX).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** Primer mensaje de error de un resultado fallido, para mostrarlo tal cual. */
export function firstIssue(result: { success: false; error: z.ZodError }): string {
  return result.error.issues[0]?.message ?? "Datos no válidos.";
}
