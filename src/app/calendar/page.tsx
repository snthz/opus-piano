import { PageHeader } from "@/components/ui/page-header";
import { ClientOnly } from "@/components/ui/client-only";
import { StudySessions } from "@/components/calendar/study-sessions";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Mis sesiones de estudio",
  description: "Tu sesión de estudio de cada día, paso a paso y con cronómetro: calentamiento con la escala, el objetivo del día y el repaso.",
  path: "/calendar",
  noindex: true,
});

export default function SessionsPage() {
  return (
    <div>
      <PageHeader eyebrow="Sesiones" title="Sesiones de estudio" intro="Cada día, una sesión con sus pasos y su cronómetro. El objetivo es hacerla." />
      {/* Las sesiones salen de IndexedDB: solo existen en el navegador. */}
      <ClientOnly>
        <StudySessions />
      </ClientOnly>
    </div>
  );
}
