import { ClientOnly } from "@/components/ui/client-only";
import { AuthPage } from "@/components/account/auth-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Crear cuenta",
  description: "Crea tu cuenta gratuita de Opus Piano y lleva tu progreso a cualquier dispositivo.",
  path: "/register",
  noindex: true,
});

export default function RegisterPage() {
  return (
    <ClientOnly>
      <AuthPage mode="register" />
    </ClientOnly>
  );
}
