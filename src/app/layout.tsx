import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppNav } from "@/components/nav/app-nav";
import { AppHeader } from "@/components/nav/app-header";
import { ServiceWorkerInit, InstallBanner } from "@/components/ui/service-worker-init";
import { ProgressSync } from "@/components/ui/progress-sync";
import { AuthModal } from "@/components/account/auth-modal";
import { ThemeEffect } from "@/components/ui/theme-effect";
import { THEME_COLORS, THEME_INIT_SCRIPT } from "@/lib/theme";
import { JsonLd } from "@/components/seo/json-ld";
import {
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_LOCALE,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
  OG_IMAGE,
  siteJsonLd,
} from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Base de todas las URL relativas de los metadatos (canónicas, og:image…).
  // Sin ella Next avisa y las etiquetas salen con rutas relativas, que los
  // buscadores y las redes sociales no saben resolver.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE} gratis y en español`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "education",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
    title: `${SITE_NAME} — ${SITE_TAGLINE} gratis y en español`,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: SITE_NAME,
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // El script de tema marca data-theme y color-scheme antes de hidratar.
      suppressHydrationWarning
    >
      {/* Abajo deja sitio a la barra móvil; en escritorio la navegación va arriba. */}
      <body className="min-h-full flex flex-col pb-28 md:pb-0">
        {/* Antes de pintar nada: evita el destello claro con el tema oscuro. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <AppHeader />
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 md:px-8 pt-4 md:pt-8 pb-10">
          {children}
        </main>
        <AppNav />
        <ServiceWorkerInit />
        <ProgressSync />
        <InstallBanner />
        <AuthModal />
        <ThemeEffect />
        {/* Identidad del sitio para Google: se declara una vez, en el layout. */}
        <JsonLd data={siteJsonLd()} />
      </body>
    </html>
  );
}
