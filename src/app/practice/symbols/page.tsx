import { SymbolFlashcards } from "@/components/practice/symbol-flashcards";
import { ClientOnly } from "@/components/ui/client-only";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Flashcards de símbolos musicales",
  description:
    "Tarjetas al azar con los símbolos de la partitura: dinámicas, articulaciones, adornos y repeticiones. Ves el signo y dices qué significa.",
  path: "/practice/symbols",
  keywords: ["flashcards musicales", "test de símbolos musicales", "signos de la partitura", "memorizar símbolos"],
});

export default function Page() {
  return (
    <ClientOnly>
      <SymbolFlashcards />
    </ClientOnly>
  );
}
