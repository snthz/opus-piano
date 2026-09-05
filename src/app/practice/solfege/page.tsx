import { SolfegeReading } from "@/components/practice/solfege-reading";
import { ClientOnly } from "@/components/ui/client-only";

export const metadata = { title: "Práctica: solfeo" };

export default function Page() {
  return (
    <ClientOnly>
      <SolfegeReading />
    </ClientOnly>
  );
}
