import { KeySignatureQuiz } from "@/components/practice/key-signature-quiz";
import { ClientOnly } from "@/components/ui/client-only";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Ejercicio: reconocer armaduras",
  description:
    "Mira los sostenidos o bemoles del principio del pentagrama y di en qué tonalidad está la pieza, sin recitar el círculo de quintas.",
  path: "/practice/key-signatures",
  keywords: ["ejercicio de armaduras", "reconocer tonalidad", "test círculo de quintas", "armaduras de clave"],
});

export default function Page() {
  return (
    <ClientOnly>
      <KeySignatureQuiz />
    </ClientOnly>
  );
}
