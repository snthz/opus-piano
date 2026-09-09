import { PageHeader } from "@/components/ui/page-header";
import { TeacherChat } from "@/components/teacher/teacher-chat";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Pregunta al profesor de piano",
  description:
    "Resuelve cualquier duda de lenguaje musical o de piano: teoría, lectura, digitación o cómo organizar el estudio. Responde en español y te enlaza la lección o el ejercicio de Opus Piano donde seguir.",
  path: "/teacher",
  keywords: ["dudas de teoría musical", "profesor de piano online", "cómo se lee una partitura"],
});

export default function TeacherPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Profesor"
        title="Pregunta lo que sea"
        intro="Dudas de música: teoría, lectura, técnica o cómo organizar el estudio. Conoce las lecciones y los ejercicios de la app, así que te dice dónde seguir. De otros temas no sabe nada."
      />
      <TeacherChat />
    </div>
  );
}
