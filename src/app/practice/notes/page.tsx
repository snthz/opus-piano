import { NoteReading } from "@/components/practice/note-reading";
import { ClientOnly } from "@/components/ui/client-only";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Ejercicio: leer notas en el pentagrama",
  description:
    "Identifica la nota que aparece en el pentagrama, en clave de sol o de fa, y gana velocidad de lectura. Corrige al momento y guarda tu progreso.",
  path: "/practice/notes",
  keywords: ["ejercicio leer notas", "practicar lectura de notas", "test de notas musicales", "lectura a primera vista"],
});

export default function Page() {
  return (
    <ClientOnly>
      <NoteReading />
    </ClientOnly>
  );
}
