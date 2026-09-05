import Link from "next/link";
import { breadcrumbJsonLd } from "@/lib/seo";
import { JsonLd } from "./json-ld";

export interface Crumb {
  name: string;
  path: string;
}

/**
 * Migas de pan visibles + su JSON-LD. Google usa el marcado para dibujar la
 * ruta bajo el título del resultado, y los enlaces internos reparten autoridad
 * hacia las páginas índice.
 *
 * El último elemento es la página actual y no se enlaza.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const trail: Crumb[] = [{ name: "Inicio", path: "/" }, ...items];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(trail)} />
      <nav aria-label="Migas de pan" className="mb-4">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
          {trail.map((item, i) => {
            const last = i === trail.length - 1;
            return (
              <li key={item.path} className="flex items-center gap-1.5">
                {last ? (
                  <span aria-current="page" className="text-ink-2">{item.name}</span>
                ) : (
                  <>
                    <Link href={item.path} className="hover:text-ink transition-colors">
                      {item.name}
                    </Link>
                    <span aria-hidden>/</span>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
