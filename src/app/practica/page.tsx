import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Práctica" };

export default function PracticaPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Práctica"
        title="Ejercicios"
        intro="Lectura de notas, ritmo, solfeo y símbolos. Próximamente."
      />
    </div>
  );
}
