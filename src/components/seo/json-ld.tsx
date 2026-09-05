import type { JsonLdObject } from "@/lib/seo";

/**
 * Inserta datos estructurados schema.org. Google los lee del HTML servido, así
 * que el componente debe quedarse en el servidor (nada de "use client").
 *
 * Se escapa `<` porque un `</script>` dentro de una cadena JSON cerraría la
 * etiqueta antes de tiempo.
 */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  const json = JSON.stringify(Array.isArray(data) ? data : [data]).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
