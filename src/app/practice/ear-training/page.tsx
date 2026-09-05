import { EarTraining } from "@/components/practice/ear-training";
import { ClientOnly } from "@/components/ui/client-only";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Ejercicio de oído: reconocer intervalos",
  description:
    "Escucha dos notas y di qué intervalo forman. Entrenamiento auditivo progresivo para empezar a reconocer de oído lo que después se lee en la partitura.",
  path: "/practice/ear-training",
  keywords: ["entrenamiento auditivo", "reconocer intervalos de oído", "ear training español", "educación auditiva"],
});

export default function Page() {
  return (
    <ClientOnly>
      <EarTraining />
    </ClientOnly>
  );
}
