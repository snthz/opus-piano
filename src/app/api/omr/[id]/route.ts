import type { NextRequest } from "next/server";

const OMR_URL = process.env.OMR_URL ?? "http://localhost:8000";

/** Estado de un trabajo de transcripción; cuando termina incluye el MusicXML. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/omr/[id]">) {
  const { id } = await ctx.params;
  if (!/^[a-f0-9-]{8,64}$/.test(id)) return Response.json({ error: "Id no válido" }, { status: 400 });
  try {
    const res = await fetch(`${OMR_URL}/jobs/${id}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ error: "El servicio de transcripción no está disponible" }, { status: 503 });
  }
}
