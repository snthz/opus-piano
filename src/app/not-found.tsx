import Link from "next/link";
import { GlyphIcon } from "@/components/notation/glyph-icon";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import { PageHeader } from "@/components/ui/page-header";
import type { Metadata } from "next";

// Sin canónica ni Open Graph: una 404 no tiene dirección propia que indexar.
// Next ya añade el `noindex` a toda respuesta 404; aquí se deja explícito.
export const metadata: Metadata = {
  title: "Página no encontrada",
  description: "La dirección que has abierto no existe en Opus Piano.",
  robots: { index: false, follow: true },
};

/**
 * Salidas de la 404: las mismas cuatro secciones que la portada, con el mismo
 * glifo cada una, para que quien llegue aquí desde un enlace roto reconozca
 * la app al instante y tenga a un toque lo que probablemente buscaba.
 */
const sections = [
  { href: "/theory", title: "Teoría", glyph: "gClef" },
  { href: "/practice", title: "Práctica", glyph: "noteQuarterUp" },
  { href: "/scores", title: "Partituras", glyph: "fClef" },
  { href: "/glossary", title: "Glosario", glyph: "dynamicForte" },
];

/**
 * Página 404 de toda la app: la enseña Next cuando la URL no existe o cuando
 * una página llama a `notFound()` (símbolos y glosario). Se pinta dentro del
 * layout raíz, así que lleva cabecera, barra y pie como cualquier otra.
 */
export default function NotFound() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Error 404"
        title="Aquí no suena nada"
        intro="La dirección que has abierto no existe o ya no está. Puede que el enlace esté mal escrito o que la página haya cambiado de sitio."
      />

      {/* Un silencio de negra en el pentagrama: el chiste visual de una
          página en blanco. El glifo grande al fondo es el mismo recurso que
          las tarjetas de la portada. */}
      <section className="card border border-line relative overflow-hidden p-5 md:p-6">
        <GlyphIcon
          name="restQuarter"
          size={200}
          className="absolute -right-6 -bottom-10 opacity-[0.06] pointer-events-none"
        />
        <div className="relative flex items-center gap-4">
          <span className="w-12 h-12 shrink-0 rounded-full bg-ink text-bg flex items-center justify-center">
            <GlyphIcon name="restQuarter" size={24} label="Silencio de negra" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold tracking-tight">Silencio</p>
            <p className="text-sm text-ink-2 leading-relaxed">
              En una partitura, un compás vacío también se escribe. Esta página, en cambio, no
              está en ninguna parte.
            </p>
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap gap-2">
          <Link href="/" className="pill pill-active">
            Ir al inicio
          </Link>
          <Link href="/guide" className="pill">
            Cómo leer partituras
          </Link>
          <Link href="/faq" className="pill">
            Preguntas frecuentes
          </Link>
        </div>
      </section>

      <section aria-label="Secciones de la app" className="grid grid-cols-2 gap-3 md:gap-4">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="card border border-line relative p-4 min-h-28 flex flex-col justify-between overflow-hidden group"
          >
            <span className="w-10 h-10 rounded-full bg-ink text-bg flex items-center justify-center">
              <GlyphIcon name={s.glyph} size={22} />
            </span>
            <GlyphIcon
              name={s.glyph}
              size={120}
              className="absolute -right-5 -top-5 opacity-[0.08] pointer-events-none"
            />
            <span className="mt-3 flex items-center justify-between gap-2">
              <span className="text-lg font-semibold tracking-tight">{s.title}</span>
              <ArrowIcon className="w-5 h-5 text-ink-3 group-hover:text-ink transition-colors" />
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
