/** Lo que el cliente sabe del usuario. Nunca el hash ni las sesiones. */
export function publicUser(u: { id: string; email: string; name: string; createdAt: Date; hasPassword?: boolean; passwordHash?: string | null }) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    createdAt: u.createdAt.toISOString(),
    hasPassword: u.hasPassword ?? !!u.passwordHash,
  };
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
