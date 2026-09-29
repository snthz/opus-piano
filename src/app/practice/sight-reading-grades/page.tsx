import { ReadingBook } from "@/components/practice/reading-book";
import { ClientOnly } from "@/components/ui/client-only";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Cuaderno de lectura a primera vista por grados",
  description:
    "Material graduado para leer a primera vista en tu piano, del grado 1 al 5: ritmos para palmear, fórmulas para cada mano y piezas con preguntas de preparación, más lectura infinita con material nuevo de cada grado. Sin teclear nada, con metrónomo.",
  path: "/practice/sight-reading-grades",
  keywords: [
    "lectura a primera vista por grados",
    "ejercicios de primera vista piano",
    "material de lectura musical",
    "partituras graduadas para leer",
    "lectura a primera vista grado 1",
  ],
});

export default function Page() {
  return (
    <ClientOnly>
      <ReadingBook />
    </ClientOnly>
  );
}
