import Link from "next/link";
import { GlyphIcon } from "@/components/notation/glyph-icon";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import { ALL_LESSONS } from "@/data/lessons";
import { lessonPath } from "@/lib/routes";

const modules = [
  { href: "/theory", title: "Teoría", text: "Leer partituras paso a paso", glyph: "gClef", color: "bg-yellow" },
  { href: "/practice", title: "Práctica", text: "Notas, ritmo, solfeo y símbolos", glyph: "noteQuarterUp", color: "bg-mint" },
  { href: "/scores", title: "Partituras", text: "Tus PDF y MusicXML, en todos tus dispositivos", glyph: "fClef", color: "bg-lavender" },
  { href: "/glossary", title: "Glosario", text: "Términos de la A a la Z", glyph: "dynamicForte", color: "bg-pink" },
];

/** Enlaces de contenido: son las páginas por las que llega la gente desde Google. */
const guides = [
  { href: "/guide", title: "Cómo leer partituras", text: "La guía completa, del pentagrama a los símbolos." },
  { href: "/symbols", title: "Símbolos de la partitura", text: "Diccionario visual de los signos musicales." },
  { href: "/faq", title: "Preguntas frecuentes", text: "Por dónde empezar y cuánto se tarda." },
];

export default function Home() {
  const firstLessons = ALL_LESSONS.slice(0, 3);
  return (
    <div className="space-y-8">
      <section className="pt-2">
        <p className="text-ink-2">¡Hola de nuevo!</p>
        <h1 className="mt-1 text-3xl md:text-4xl font-bold tracking-tight leading-tight">
          Aprende a leer música
          <br />y a tocar el piano
        </h1>
        {/* Primer párrafo real de la página: es lo que un buscador (y quien
            llega por primera vez) usa para saber de qué va esto. */}
        <p className="mt-3 text-ink-2 leading-relaxed max-w-2xl">
          Curso gratuito de lenguaje musical y piano en español. Solfeo, claves, notas, figuras,
          compases, armaduras y todos los símbolos de la partitura, con ejercicios que corrigen
          solos. Sin cuentas de pago y funciona sin conexión.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 md:gap-4">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className={`card-pastel ${m.color} relative p-4 md:p-5 min-h-44 flex flex-col justify-between overflow-hidden group`}
          >
            <span className="w-10 h-10 rounded-full bg-surface/90 flex items-center justify-center">
              <GlyphIcon name={m.glyph} size={22} />
            </span>
            <GlyphIcon
              name={m.glyph}
              size={150}
              className="absolute -right-6 -top-6 opacity-[0.08] pointer-events-none"
            />
            <span className="pr-10">
              <span className="block text-xl font-semibold tracking-tight">{m.title}</span>
              <span className="block text-sm text-ink-2 mt-0.5">{m.text}</span>
            </span>
            <span className="btn-circle absolute right-3 bottom-3 w-10 h-10 group-hover:-translate-y-0.5">
              <ArrowIcon />
            </span>
          </Link>
        ))}
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-xl font-semibold tracking-tight">Empieza por aquí</h2>
          <Link href="/theory" className="text-sm text-ink-2 hover:text-ink">
            Ver todo
          </Link>
        </div>
        <ul className="space-y-2">
          {firstLessons.map((l, i) => (
            <li key={l.slug}>
              <Link href={lessonPath(l.slug)} className="card p-3 pr-4 flex items-center gap-3">
                <span className="w-12 h-12 rounded-full bg-blue flex items-center justify-center shrink-0">
                  <GlyphIcon name={l.glyph} size={24} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium truncate">
                    {i + 1}. {l.title}
                  </span>
                  <span className="block text-xs text-ink-3">{l.minutes} min</span>
                </span>
                <ArrowIcon className="w-5 h-5 text-ink-3" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight mb-3">Guías y referencia</h2>
        <ul className="grid sm:grid-cols-3 gap-3">
          {guides.map((g) => (
            <li key={g.href}>
              <Link href={g.href} className="card p-4 h-full block hover:bg-surface-2 transition-colors">
                <span className="block font-semibold">{g.title}</span>
                <span className="block text-sm text-ink-2 mt-0.5">{g.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
