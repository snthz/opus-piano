/**
 * Error cuyo mensaje ya está escrito para el usuario y se puede enseñar tal
 * cual. Todo lo demás que se escape de una tarea se sustituye por un texto
 * genérico, porque suele llevar rutas, trazas o jerga del proveedor.
 */
export class UserError extends Error {}

/** Distingue el corte por el usuario (AbortError) de un fallo de verdad. */
export const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";
