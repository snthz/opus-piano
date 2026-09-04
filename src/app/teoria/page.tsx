import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import { GlyphIcon } from "@/components/notation/glyph-icon";
import { LESSON_SECTIONS, ALL_LESSONS } from "@/data/lessons";

export const metadata = { title: "Teoría" };

const COLORS = ["bg-yellow", "bg-mint", "bg-lavender", "bg-pink", "bg-blue", "bg-peach"];

export default function TeoriaPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Teoría"
        title="Aprende a leer música"
        intro="Lecciones ordenadas desde el pentagrama hasta las tonalidades. Cada una incluye ejemplos que puedes escuchar y símbolos con los glifos originales."
      />
      <div className="space-y-8">
        {LESSON_SECTIONS.map((section) => (
          <section key={section.id}>
            <h2 className="text-lg font-semibold tracking-tight mb-3">{section.title}</h2>
            <ol className="grid grid-cols-2 gap-3">
              {section.lessons.map((l) => {
                const n = ALL_LESSONS.indexOf(l) + 1;
                const color = COLORS[(n - 1) % COLORS.length];
                return (
                  <li key={l.slug}>
                    <Link
                      href={`/teoria/${l.slug}`}
                      className={`card-pastel ${color} relative p-4 min-h-40 flex flex-col justify-between group`}
                    >
                      <span className="w-10 h-10 rounded-full bg-surface/90 flex items-center justify-center">
                        <GlyphIcon name={l.glyph} size={22} />
                      </span>
                      <span className="pr-10">
                        <span className="block text-xs text-ink-2">Lección {n}</span>
                        <span className="block font-semibold leading-tight mt-0.5">{l.title}</span>
                        <span className="block text-xs text-ink-2 mt-1">{l.minutes} min</span>
                      </span>
                      <span className="btn-circle absolute right-3 bottom-3 w-9 h-9 group-hover:-translate-y-0.5">
                        <ArrowIcon className="w-4 h-4" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
