import Link from "next/link";
import { Glyph } from "@/components/notation/glyph";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import { ALL_LESSONS } from "@/data/lessons";

const modules = [
  { href: "/teoria", title: "Teoría", text: "Leer partituras paso a paso", glyph: "gClef", color: "bg-yellow" },
  { href: "/practica", title: "Práctica", text: "Notas, ritmo, solfeo y símbolos", glyph: "noteQuarterUp", color: "bg-mint" },
  { href: "/partituras", title: "Partituras", text: "Tus PDF, solo en tu teléfono", glyph: "fClef", color: "bg-lavender" },
  { href: "/glosario", title: "Glosario", text: "Términos de la A a la Z", glyph: "dynamicForte", color: "bg-pink" },
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
      </section>

      <section className="grid grid-cols-2 gap-3 md:gap-4">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className={`card-pastel ${m.color} relative p-4 md:p-5 min-h-44 flex flex-col justify-between overflow-hidden group`}
          >
            <span className="w-10 h-10 rounded-full bg-surface/90 flex items-center justify-center">
              <Glyph name={m.glyph} size={22} />
            </span>
            <Glyph
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
          <Link href="/teoria" className="text-sm text-ink-2 hover:text-ink">
            Ver todo
          </Link>
        </div>
        <ul className="space-y-2">
          {firstLessons.map((l, i) => (
            <li key={l.slug}>
              <Link href={`/teoria/${l.slug}`} className="card p-3 pr-4 flex items-center gap-3">
                <span className="w-12 h-12 rounded-full bg-blue flex items-center justify-center shrink-0">
                  <Glyph name={l.glyph} size={24} />
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
    </div>
  );
}
