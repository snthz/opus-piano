import { PageHeader } from "@/components/ui/page-header";
import { ClientOnly } from "@/components/ui/client-only";
import { ScoreLibrary } from "@/components/scores/score-library";

export const metadata = { title: "Mis partituras" };

export default function PartiturasPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Biblioteca"
        title="Mis partituras"
        intro="Tus PDF guardados solo en este dispositivo. Nadie más puede verlos."
      />
      <ClientOnly>
        <ScoreLibrary />
      </ClientOnly>
    </div>
  );
}
