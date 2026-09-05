import { SolfegeReading } from "@/components/practice/solfege-reading";
import { ClientOnly } from "@/components/ui/client-only";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Ejercicio de solfeo: leer y cantar",
  description:
    "Melodías cortas para leer en voz alta con el nombre de las notas y comprobar después cómo suenan. Solfeo sin necesidad de instrumento.",
  path: "/practice/solfege",
  keywords: ["ejercicios de solfeo", "solfeo online", "cantar notas", "solfeo para principiantes"],
});

export default function Page() {
  return (
    <ClientOnly>
      <SolfegeReading />
    </ClientOnly>
  );
}
