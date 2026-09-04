import { PageHeader } from "@/components/ui/page-header";
import { ClientOnly } from "@/components/ui/client-only";
import { SettingsPanel } from "@/components/settings/settings-panel";

export const metadata = { title: "Ajustes" };

export default function AjustesPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Ajustes"
        title="Preferencias"
        intro="Ajusta cómo se muestran las notas, el sonido y los datos guardados en este dispositivo."
      />
      <ClientOnly>
        <SettingsPanel />
      </ClientOnly>
    </div>
  );
}
