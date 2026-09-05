const OMR_URL = process.env.OMR_URL ?? "http://localhost:8000";
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Envía un PDF al servicio de transcripción (oemer) y devuelve el id del trabajo.
 * El navegador solo habla con este origen; la dirección del servicio es interna.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Falta el archivo PDF" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "El PDF supera los 25 MB" }, { status: 413 });

  const upstream = new FormData();
  upstream.append("file", file, file.name || "partitura.pdf");
  try {
    const res = await fetch(`${OMR_URL}/jobs`, { method: "POST", body: upstream });
    const data = await res.json().catch(() => ({}));
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ error: "El servicio de transcripción no está disponible" }, { status: 503 });
  }
}
