import { NoteReading } from "@/components/practice/note-reading";
import { ClientOnly } from "@/components/ui/client-only";

export const metadata = { title: "Práctica: leer notas" };

export default function Page() {
  return (
    <ClientOnly>
      <NoteReading />
    </ClientOnly>
  );
}
