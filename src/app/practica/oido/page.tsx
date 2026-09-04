import { EarTraining } from "@/components/practice/ear-training";
import { ClientOnly } from "@/components/ui/client-only";

export const metadata = { title: "Práctica: oído" };

export default function Page() {
  return (
    <ClientOnly>
      <EarTraining />
    </ClientOnly>
  );
}
