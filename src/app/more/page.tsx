import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { AUTHOR_NAME, STUDIO_NAME, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Más: teoría, glosario, guía y preguntas frecuentes",
  description:
    "El resto de recursos de Opus Piano: las lecciones de teoría, el glosario de términos, el diccionario de símbolos, la guía para leer partituras, las preguntas frecuentes y los ajustes.",
  path: "/more",
  keywords: [
    "recursos musicales",
    "opus piano",
    "glosario musical",
    "diccionario de símbolos musicales",
    "guía para leer partituras",
    "teoría musical gratis",
  ],
});

const links = [
  { href: "/theory", title: "Teoría", text: "Las lecciones, en orden: del pentagrama y las notas al ritmo, las escalas y los acordes." },
  { href: "/guide", title: "Guía para leer partituras", text: "El recorrido completo, del pentagrama a los símbolos, en una sola página." },
  { href: "/symbols", title: "Diccionario de símbolos", text: "Todos los signos de la partitura, por familias, con su significado." },
  { href: "/metronome", title: "Metrónomo", text: "Tempo, compás y subdivisión para practicar a un pulso constante." },
  { href: "/glossary", title: "Glosario", text: "Términos musicales de la A a la Z." },
  { href: "/faq", title: "Preguntas frecuentes", text: "Cuánto se tarda, por dónde se empieza y qué hace falta para practicar." },
  { href: "/account", title: "Cuenta", text: "Entra o crea una cuenta para guardar tu progreso en todos tus dispositivos." },
  { href: "/settings", title: "Ajustes", text: "Nombres de notas, sonido y datos guardados." },
];

export default function MasPage() {
  return (
    <div>
      <PageHeader eyebrow="Más" title="Recursos y ajustes" />
      <ul className="grid gap-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="card p-4 block hover:border-accent/60 transition-colors">
              <span className="font-semibold">{l.title}</span>
              <span className="block text-sm text-ink-2 mt-0.5">{l.text}</span>
            </Link>
          </li>
        ))}
      </ul>
      {/* Quién hay detrás: además de ser justo, es la señal de autoría que
          Google espera de un sitio educativo (E-E-A-T). */}
      <p className="mt-8 text-xs text-ink-3">
        Opus Piano lo desarrolla <span className="text-ink-2 font-medium">{STUDIO_NAME}</span>, el
        estudio de {AUTHOR_NAME}. Todos los derechos reservados. Fuentes musicales Bravura y
        Academico de Steinberg bajo licencia SIL OFL 1.1.
      </p>
    </div>
  );
}
