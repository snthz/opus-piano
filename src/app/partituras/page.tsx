import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Mis partituras" };

export default function PartiturasPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Biblioteca"
        title="Mis partituras"
        intro="Tus PDF guardados en este dispositivo. Próximamente."
      />
    </div>
  );
}
