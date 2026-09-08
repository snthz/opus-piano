import Link from "next/link";
import { LogoMark } from "@/components/ui/logo";
import {
  AUTHOR_NAME,
  AUTHOR_URL,
  COPYRIGHT_YEAR,
  SITE_NAME,
  SITE_TAGLINE,
  STUDIO_NAME,
  STUDIO_URL,
} from "@/lib/seo";

/**
 * Columnas de enlaces del pie. Solo contenido indexable: son enlaces que
 * aparecen en todas las páginas, así que reparten autoridad hacia las páginas
 * que interesa posicionar y le dan a Google un mapa del sitio en cada visita.
 * Cuenta y ajustes van aparte, con `rel="nofollow"`, porque robots.txt los
 * bloquea y no tiene sentido gastar rastreo en ellos.
 */
const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Aprender",
    links: [
      { href: "/theory", label: "Teoría musical" },
      { href: "/practice", label: "Ejercicios de solfeo" },
      { href: "/guide", label: "Cómo leer partituras" },
      { href: "/theory/staff", label: "El pentagrama" },
      { href: "/theory/clefs", label: "Clave de sol y clave de fa" },
    ],
  },
  {
    title: "Referencia",
    links: [
      { href: "/symbols", label: "Símbolos de la partitura" },
      { href: "/glossary", label: "Glosario musical" },
      { href: "/theory/note-values", label: "Figuras y silencios" },
      { href: "/theory/key-signatures", label: "Armaduras de clave" },
      { href: "/faq", label: "Preguntas frecuentes" },
    ],
  },
  {
    title: "Practicar",
    links: [
      { href: "/practice/notes", label: "Leer notas" },
      { href: "/practice/keyboard", label: "Notas en el teclado" },
      { href: "/practice/rhythm", label: "Ritmo" },
      { href: "/practice/solfege", label: "Solfeo" },
      { href: "/practice/ear-training", label: "Entrenamiento auditivo" },
    ],
  },
];

/**
 * Enlaces de la zona privada. Van en su propia columna, con `rel="nofollow"`:
 * robots.txt las bloquea y no tiene sentido gastar rastreo en ellas, pero para
 * quien ya usa la app son los accesos más rápidos del pie.
 */
const ACCOUNT_LINKS = [
  { href: "/scores", label: "Mis partituras" },
  { href: "/account", label: "Cuenta" },
  { href: "/settings", label: "Ajustes" },
  { href: "/more", label: "Más" },
];

/** Lo que resume la app en tres golpes: gratis, sin conexión y en español. */
const BADGES = ["Gratis", "Funciona sin conexión", "En español"];

/**
 * Pie de página del sitio: la firma (autor y estudio) y el mapa de enlaces
 * internos. Es un componente de servidor —no tiene estado— para que su
 * contenido viaje en el HTML que lee el buscador.
 *
 * En móvil queda por encima de la barra flotante gracias al `pb-28` del
 * `body` en el layout.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      {/* Teclas: el mismo motivo del logotipo, en una franja de 6 px. Decorativo
          puro, de ahí el aria-hidden. */}
      <div
        aria-hidden
        className="h-1.5 w-full bg-[repeating-linear-gradient(90deg,var(--line)_0_1px,transparent_1px_14px)]"
      />

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-10 md:py-12">
        {/* En móvil, dos columnas: con una sola, el pie mide tres pantallas. */}
        <div className="grid gap-8 grid-cols-2 md:grid-cols-[1.4fr_1.1fr_1.1fr_1fr_0.9fr]">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 text-ink">
              <LogoMark className="w-6 h-6" />
              <span className="font-bold tracking-tight text-lg">{SITE_NAME}</span>
            </Link>
            <p className="mt-2 text-sm text-ink-2 leading-relaxed max-w-xs">
              {SITE_TAGLINE}. Curso gratuito de lenguaje musical en español, con ejercicios
              interactivos y sin conexión.
            </p>

            <ul className="mt-4 flex flex-wrap gap-1.5">
              {BADGES.map((badge) => (
                <li
                  key={badge}
                  className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-ink-2"
                >
                  {badge}
                </li>
              ))}
            </ul>

            <Link
              href="/practice"
              className="btn-primary mt-5 text-sm py-2.5 px-4 w-full sm:w-auto"
            >
              Empezar a practicar
            </Link>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              {/* Un <p> y no un <h2>: el `aria-label` del <nav> ya agrupa los
                  enlaces, y así el esquema de encabezados de cada página lo
                  marca solo su contenido, no el pie que se repite en todas. */}
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                {column.title}
              </p>
              <ul className="mt-3 space-y-1.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-ink-2 hover:text-ink transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <nav aria-label="Tu cuenta">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
              Tu cuenta
            </p>
            <ul className="mt-3 space-y-1.5">
              {ACCOUNT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    rel="nofollow"
                    className="text-sm text-ink-2 hover:text-ink transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 pt-6 border-t border-line flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="text-xs text-ink-2">
              © {COPYRIGHT_YEAR} {SITE_NAME}. Todos los derechos reservados.
            </p>
            {/* La atribución de las fuentes no es cortesía: la licencia SIL OFL
                obliga a citarlas allá donde se usan. */}
            <p className="text-[11px] text-ink-3">
              Fuentes musicales Bravura y Academico © Steinberg, bajo licencia SIL OFL 1.1.
            </p>
          </div>

          {/* La firma: autor y estudio, cada uno enlazado a su web.
              `rel="author"` es la pista que usan los buscadores para asociar
              el sitio con quien lo escribe. */}
          <p className="text-xs text-ink-2 md:text-right">
            Desarrollado por{" "}
            <a
              href={STUDIO_URL}
              rel="author noopener"
              target="_blank"
              className="font-semibold text-ink hover:underline"
            >
              {STUDIO_NAME}
            </a>{" "}
            ·{" "}
            <span className="whitespace-nowrap">
              por{" "}
              <a
                href={AUTHOR_URL}
                rel="author noopener"
                target="_blank"
                className="font-medium text-ink hover:underline"
              >
                {AUTHOR_NAME}
              </a>
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
