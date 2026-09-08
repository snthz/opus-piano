/**
 * Error cuyo mensaje ya está escrito para el usuario y se puede enseñar tal
 * cual. Todo lo demás que se escape de una tarea se sustituye por un texto
 * genérico, porque suele llevar rutas, trazas o jerga del proveedor.
 */
export class UserError extends Error {}
