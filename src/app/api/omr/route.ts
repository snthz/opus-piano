// evaluated per request: OMR_URL comes from env, not the build
export const dynamic = "force-dynamic";

import { omrEnabled } from "@/lib/server/omr";

/**
 * Whether this server has score recognition configured.
 *
 * Recognition itself lives in `/api/transcriptions`: it takes minutes per
 * page and has to survive the browser leaving, so it's a job the server
 * keeps, not a request the browser waits on.
 */
export function GET() {
  return Response.json({ enabled: omrEnabled() }, { headers: { "Cache-Control": "no-store" } });
}
