/** Error with a message already fit to show the user. */
export class UserError extends Error {}

/** Distinguishes the user's own cancel (AbortError) from a real failure. */
export const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";
