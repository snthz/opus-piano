import { llmsFullTxt } from "@/lib/llms";

export const dynamic = "force-static";

/** `/llms-full.txt`: todo el contenido citable en un archivo. Ver `src/lib/llms.ts`. */
export function GET(): Response {
  return new Response(llmsFullTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
