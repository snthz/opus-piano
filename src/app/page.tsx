import Link from "next/link";
import { ContinueStudying } from "@/components/home/continue-studying";
import { ProgressSummary } from "@/components/home/progress-summary";
import { TodayRoutine } from "@/components/home/today-routine";
import { GlyphIcon } from "@/components/notation/glyph-icon";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import { ALL_LESSONS } from "@/data/lessons";
import { lessonPath } from "@/lib/routes";

/**
 * The four ways out of the home page. No pastel here: white with a hairline and
 * the glyph on a black circle, like a white key with its black one — what tells
 * one card from another is the musical symbol, not the colour.
 *
 * Title only: a line of copy under each card turned four buttons into four
 * paragraphs, and every section already explains itself on its own page.
 */
const modules = [
  { href: "/theory", title: "Teoría", glyph: "gClef" },
  { href: "/practice", title: "Práctica", glyph: "noteQuarterUp" },
  { href: "/scores", title: "Partituras", glyph: "fClef" },
  { href: "/glossary", title: "Glosario", glyph: "dynamicForte" },
];

/**
 * Content links: these are the pages people land on from Google. Plain links
 * rather than cards, because as cards they competed with the summary and the
 * four sections; the crawler values them the same either way.
 */
const guides = [
  { href: "/guide", title: "Cómo leer partituras" },
  { href: "/teacher", title: "Pregunta al profesor" },
  { href: "/symbols", title: "Símbolos de la partitura" },
  { href: "/faq", title: "Preguntas frecuentes" },
];

export default function Home() {
  const [first] = ALL_LESSONS;
  return (
    <div className="space-y-6">
      <section className="pt-2">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
          Aprende a leer música
          <br />y a tocar el piano
        </h1>
        {/* The only paragraph on the home page: what a search engine (and a
            first-time visitor) reads to know what this is. */}
        <p className="mt-2 text-ink-2 leading-relaxed max-w-xl">
          Curso gratuito de lenguaje musical y piano en español, con ejercicios que se corrigen
          solos. Sin pagar y sin conexión.
        </p>
      </section>

      {/* First thing after the title, so on a phone the scores in hand are one
          tap away. Only shows up with something marked "en estudio" or a route. */}
      <ContinueStudying />

      <ProgressSummary
        nextLesson={{ title: first.title, href: lessonPath(first.slug), minutes: first.minutes }}
      />

      {/* Only shows up with a scheduled score; it comes from IndexedDB. */}
      <TodayRoutine />

      {/* The four cards below are a catalogue, and a catalogue only helps once
          you know what you are looking for. This is the answer for whoever
          does not: one ordered path through everything that is already here. */}
      <Link href="/path" className="card-pastel bg-yellow relative overflow-hidden p-5 flex items-center gap-4 group">
        <GlyphIcon name="noteQuarterUp" size={140} className="absolute -right-6 -top-8 opacity-[0.09] pointer-events-none" />
        <span className="relative min-w-0 flex-1">
          <span className="block text-xs text-ink-2">¿No sabes por dónde empezar?</span>
          <span className="mt-0.5 block text-lg font-semibold leading-tight tracking-tight">Sigue la ruta</span>
          <span className="mt-1 block text-sm leading-relaxed text-ink-2">
            Las lecciones, los ejercicios y las piezas en orden, con el motivo de por qué toca cada uno.
          </span>
        </span>
        <span className="btn-circle relative shrink-0 group-hover:-translate-y-0.5">
          <ArrowIcon className="w-5 h-5" />
        </span>
      </Link>

      <section className="grid grid-cols-2 gap-3 md:gap-4">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="card border border-line relative p-4 min-h-28 flex flex-col justify-between overflow-hidden group"
          >
            <span className="w-10 h-10 rounded-full bg-ink text-bg flex items-center justify-center">
              <GlyphIcon name={m.glyph} size={22} />
            </span>
            <GlyphIcon
              name={m.glyph}
              size={120}
              className="absolute -right-5 -top-5 opacity-[0.08] pointer-events-none"
            />
            <span className="mt-3 flex items-center justify-between gap-2">
              <span className="text-lg font-semibold tracking-tight">{m.title}</span>
              <ArrowIcon className="w-5 h-5 text-ink-3 group-hover:text-ink transition-colors" />
            </span>
          </Link>
        ))}
      </section>

      <nav aria-label="Guías y referencia" className="flex flex-wrap gap-2">
        {guides.map((g) => (
          <Link key={g.href} href={g.href} className="pill">
            {g.title}
          </Link>
        ))}
      </nav>
    </div>
  );
}
