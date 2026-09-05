import { PageHeader } from "@/components/ui/page-header";
import { ClientOnly } from "@/components/ui/client-only";
import { AccountPanel } from "@/components/account/account-panel";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Cuenta",
  description:
    "Tu cuenta de Opus Piano y los dispositivos vinculados a tu progreso.",
  path: "/account",
  noindex: true,
});

export default function CuentaPage() {
  return (
    <div className="max-w-md">
      <PageHeader
        eyebrow="Cuenta"
        title="Tu progreso, en todos tus dispositivos"
        intro="Con una cuenta, lo que practicas se guarda en el servidor y aparece igual en el móvil y en el ordenador. Sin cuenta, la app funciona igual pero el progreso se queda solo en este dispositivo."
      />
      <ClientOnly>
        <AccountPanel />
      </ClientOnly>
    </div>
  );
}
