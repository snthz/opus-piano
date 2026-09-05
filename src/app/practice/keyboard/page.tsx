import { KeyboardReading } from "@/components/practice/keyboard-reading";
import { ClientOnly } from "@/components/ui/client-only";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Ejercicio: del pentagrama a la tecla",
  description:
    "Lee la nota escrita y púlsala en el teclado. El ejercicio que une la lectura de la partitura con la posición real de la nota en el piano.",
  path: "/practice/keyboard",
  keywords: ["ejercicio teclado piano", "notas en el teclado", "practicar piano online", "teclado virtual"],
});

export default function Page() {
  return (
    <ClientOnly>
      <KeyboardReading />
    </ClientOnly>
  );
}
