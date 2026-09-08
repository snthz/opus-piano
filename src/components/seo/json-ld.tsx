import type { JsonLdObject } from "@/lib/seo";

/** JSON-LD for schema.org. Server-only (no "use client"); `<` is escaped so it can't close the `<script>` early. */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  const json = JSON.stringify(Array.isArray(data) ? data : [data]).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
