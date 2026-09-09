import { PageHeader } from "@/components/ui/page-header";
import { LearningPath } from "@/components/path/learning-path";
import { PATH, PATH_STEPS } from "@/data/path";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Ruta de aprendizaje: por dónde empezar a leer música",
  description:
    "El curso completo en orden: qué lección leer, qué ejercicio practicar y qué pieza tocar en cada momento, desde el pentagrama hasta las tonalidades. Marca solo tu avance.",
  path: "/path",
  keywords: ["por dónde empezar a leer música", "curso de piano ordenado", "aprender piano desde cero paso a paso"],
});

export default function PathPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Ruta"
        title="Por dónde empezar"
        intro={`Teoría, práctica y partituras puestas en fila: ${PATH_STEPS.length} pasos en ${PATH.length} etapas, con el motivo de por qué toca cada uno. Se marca solo con lo que vayas haciendo, y puedes saltarte el orden cuando quieras.`}
      />
      <LearningPath />
    </div>
  );
}
