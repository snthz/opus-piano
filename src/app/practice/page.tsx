import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import { GlyphIcon } from "@/components/notation/glyph-icon";
import { PracticeStats, ExerciseBadge } from "@/components/practice/practice-stats";
import { WeakPoints } from "@/components/practice/weak-points";
import { EXERCISES } from "@/data/exercises";
import { exercisePath } from "@/lib/routes";
import { JsonLd } from "@/components/seo/json-ld";
import { itemListJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Ejercicios de solfeo y lectura musical",
  description:
    "Ocho ejercicios interactivos que corrigen solos: lectura de notas por niveles, primera vista con metrónomo, teclado, símbolos, armaduras, ritmo, solfeo y reconocimiento de intervalos de oído.",
  path: "/practice",
  keywords: ["ejercicios de solfeo", "practicar lectura musical", "ejercicios de teoría musical", "entrenamiento auditivo"],
});

export default function PracticaPage() {
  return (
    <div>
      <JsonLd
        data={itemListJsonLd({
          name: "Ejercicios de lectura musical y solfeo",
          description: `Los ${EXERCISES.length} ejercicios interactivos de Opus Piano, gratuitos y sin registro.`,
          path: "/practice",
          items: EXERCISES.map((e) => ({ name: e.title, description: e.text, path: exercisePath(e.id) })),
        })}
      />
      <PageHeader
        eyebrow="Práctica"
        title="Ejercicios"
        intro="Sesiones cortas y diarias. Tu progreso se guarda en este dispositivo y, con una cuenta, en todos los demás."
      />
      <PracticeStats />
      <ul className="grid grid-cols-2 gap-3 mt-6">
        {EXERCISES.map((e) => (
          <li key={e.id}>
            <Link href={exercisePath(e.id)} className={`card-pastel ${e.color} relative p-4 min-h-44 flex flex-col justify-between group`}>
              <span className="w-10 h-10 rounded-full bg-surface/90 flex items-center justify-center">
                <GlyphIcon name={e.glyph} size={22} />
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
      <WeakPoints />
    </div>
  );
}
