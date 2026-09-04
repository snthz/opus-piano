import { KeyboardReading } from "@/components/practice/keyboard-reading";
import { ClientOnly } from "@/components/ui/client-only";

export const metadata = { title: "Práctica: tocar en el teclado" };

export default function Page() {
  return (
    <ClientOnly>
      <KeyboardReading />
    </ClientOnly>
  );
}
