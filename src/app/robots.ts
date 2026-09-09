import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-static";

/**
 * Blocks anything with no search value: the API, pages with the user's own data
 * (scores, settings, account), and the offline page. `/scores/catalog` is the
 * exception — it holds the public-domain pieces, which is content, not data —
 * and needs an explicit `allow` because `/scores` blocks by prefix.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/scores/catalog"],
        disallow: ["/api/", "/scores", "/settings", "/account", "/login", "/register", "/offline"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/").replace(/\/$/, ""),
  };
}
