import { RhythmTapping } from "@/components/practice/rhythm-tapping";
import { ClientOnly } from "@/components/ui/client-only";

export const metadata = { title: "Práctica: ritmo" };

export default function Page() {
  return (
    <ClientOnly>
      <RhythmTapping />
    </ClientOnly>
  );
}
