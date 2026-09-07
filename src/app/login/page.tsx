import { ClientOnly } from "@/components/ui/client-only";
import { AuthPage } from "@/components/account/auth-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Iniciar sesión",
  description: "Entra en Opus Piano para guardar tu progreso en todos tus dispositivos.",
  path: "/login",
  noindex: true,
});

export default function LoginPage() {
  return (
    <ClientOnly>
      <AuthPage mode="login" />
    </ClientOnly>
  );
}
