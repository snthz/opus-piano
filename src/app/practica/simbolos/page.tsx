import { SymbolFlashcards } from "@/components/practice/symbol-flashcards";
import { ClientOnly } from "@/components/ui/client-only";

export const metadata = { title: "Práctica: símbolos" };

export default function Page() {
  return (
    <ClientOnly>
      <SymbolFlashcards />
    </ClientOnly>
  );
}
