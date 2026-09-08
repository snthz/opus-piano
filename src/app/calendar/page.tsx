import { PageHeader } from "@/components/ui/page-header";
import { ClientOnly } from "@/components/ui/client-only";
import { Agenda } from "@/components/calendar/agenda";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Mi agenda de estudio",
  description: "Tus sesiones de estudio día a día: qué objetivo toca, a qué hora y cómo repartir la sesión.",
  path: "/calendar",
  noindex: true,
});

export default function AgendaPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Calendario"
        title="Mi agenda"
        intro="Lo que toca tocar cada día, sacado del plan de estudio de cada partitura. Marca la sesión al terminarla para llevar la cuenta de la semana."
      />
      {/* La agenda sale de IndexedDB: solo existe en el navegador. */}
      <ClientOnly>
        <Agenda />
      </ClientOnly>
    </div>
  );
}
