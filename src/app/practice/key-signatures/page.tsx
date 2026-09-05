import { KeySignatureQuiz } from "@/components/practice/key-signature-quiz";
import { ClientOnly } from "@/components/ui/client-only";

export const metadata = { title: "Práctica: armaduras" };

export default function Page() {
  return (
    <ClientOnly>
      <KeySignatureQuiz />
    </ClientOnly>
  );
}
