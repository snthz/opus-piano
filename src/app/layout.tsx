import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppNav } from "@/components/nav/app-nav";
import { AppHeader } from "@/components/nav/app-header";
import { ServiceWorkerInit, InstallBanner } from "@/components/ui/service-worker-init";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Etude",
    template: "%s · Etude",
  },
  description:
    "Aprende a leer partituras y a tocar el piano: solfeo, claves, notas, compases y símbolos. Funciona sin conexión y guarda tus partituras en tu teléfono.",
  applicationName: "Etude",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Etude",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f3f6" },
    { media: "(prefers-color-scheme: dark)", color: "#121215" },
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
    >
      {/* Abajo deja sitio a la barra móvil; a la izquierda, al panel lateral de escritorio. */}
      <body className="min-h-full flex flex-col pb-28 md:pb-0 md:pl-72">
        <AppHeader />
        <main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-4 md:pt-8 pb-10">
          {children}
        </main>
        <AppNav />
        <ServiceWorkerInit />
        <InstallBanner />
      </body>
    </html>
  );
}
