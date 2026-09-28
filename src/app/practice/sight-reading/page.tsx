import { SightReading } from "@/components/practice/sight-reading";
import { ClientOnly } from "@/components/ui/client-only";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Ejercicio de lectura a primera vista",
  description:
    "El pentagrama avanza con el metrónomo y tocas cada nota cuando llega, en el teclado de la pantalla, el del ordenador o tu piano MIDI. Diez niveles, de la posición de do al sistema doble.",
  path: "/practice/sight-reading",
  keywords: [
    "lectura a primera vista",
    "ejercicio primera vista piano",
    "leer partituras a tiempo",
    "practicar lectura con metrónomo",
  ],
});

export default function Page() {
  return (
    <ClientOnly>
      <SightReading />
    </ClientOnly>
  );
}
