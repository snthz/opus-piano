import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import { Glyph } from "@/components/notation/glyph";
import { PracticeStats, ExerciseBadge } from "@/components/practice/practice-stats";
import { EXERCISES } from "@/data/exercises";

export const metadata = { title: "Práctica" };

export default function PracticaPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Práctica"
        title="Ejercicios"
        intro="Sesiones cortas y diarias. Tu progreso se guarda en este dispositivo."
      />
      <PracticeStats />
      <ul className="grid grid-cols-2 gap-3 mt-6">
        {EXERCISES.map((e) => (
          <li key={e.id}>
            <Link href={e.href} className={`card-pastel ${e.color} relative p-4 min-h-44 flex flex-col justify-between group`}>
              <span className="w-10 h-10 rounded-full bg-surface/90 flex items-center justify-center">
                <Glyph name={e.glyph} size={22} />
              </span>
              <span className="pr-10">
                <span className="block font-semibold leading-tight">{e.title}</span>
                <span className="block text-xs text-ink-2 mt-1">{e.text}</span>
                <span className="block mt-1.5">
                  <ExerciseBadge id={e.id} />
                </span>
              </span>
              <span className="btn-circle absolute right-3 bottom-3 w-9 h-9 group-hover:-translate-y-0.5">
                <ArrowIcon className="w-4 h-4" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
