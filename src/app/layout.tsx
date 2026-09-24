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
import { SiteFooter } from "@/components/nav/site-footer";
import { JsonLd } from "@/components/seo/json-ld";
import {
  AUTHOR_NAME,
  AUTHOR_URL,
  COPYRIGHT_YEAR,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_LOCALE,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_TITLE,
  SITE_URL,
  STUDIO_NAME,
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
    // Corto a propósito: Google corta el título del resultado sobre los 60
    // caracteres, y «gratis y en español» ya va en la descripción.
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  // Quién firma la app: el autor y el estudio que la publica. Salen como
  // <meta name="author"|"creator"|"publisher"> y los repite el JSON-LD.
  authors: [{ name: AUTHOR_NAME, url: AUTHOR_URL }],
  creator: AUTHOR_NAME,
  publisher: STUDIO_NAME,
  category: "education",
  alternates: {
    canonical: "/",
    // Declara /llms.txt en el <head> para que un agente lo encuentre sin
    // tener que probar la URL a ciegas. Es el índice del sitio en Markdown
    // (llmstxt.org); el contenido entero está en /llms-full.txt.
    types: {
      "text/plain": [
        { url: "/llms.txt", title: `${SITE_NAME}: índice del sitio para modelos de lenguaje` },
        { url: "/llms-full.txt", title: `${SITE_NAME}: contenido completo en texto` },
      ],
    },
  },
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
    // "default" (no "black-translucent"): con la traslúcida iOS pinta el reloj
    // siempre en blanco, ilegible sobre la cabecera clara. Así toma el color de
    // `themeColor` y el texto contrasta en ambos temas.
    statusBarStyle: "default",
    title: SITE_NAME,
  },
  formatDetection: { telephone: false },
  // Etiquetas sueltas que la API de metadatos no cubre: la firma del estudio
  // y el aviso de copyright que leen algunos agregadores.
  other: {
    developer: STUDIO_NAME,
    copyright: `© ${COPYRIGHT_YEAR} ${SITE_NAME} · ${STUDIO_NAME}`,
  },
  // Los íconos (favicon.ico, icon.svg, apple-icon.png) van por convención de
  // archivo en src/app: Next añade solo las etiquetas <link>. Se generan con
  // `bun run gen:icons` a partir de src/lib/brand.ts.
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
      {/* Abajo deja sitio a la barra móvil —y al gesto del sistema—; en escritorio
          (`lg`) la navegación va arriba. */}
      <body className="min-h-full flex flex-col safe-nav lg:pb-0">
        {/* Antes de pintar nada: evita el destello claro con el tema oscuro. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <AppHeader />
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 md:px-8 pt-4 md:pt-8 pb-10">
          {children}
        </main>
        <SiteFooter />
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
