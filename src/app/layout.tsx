import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppNav } from "@/components/nav/AppNav";
import { AppHeader } from "@/components/nav/AppHeader";

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
    default: "Piano Learn",
    template: "%s · Piano Learn",
  },
  description:
    "Aprende a leer partituras y a tocar el piano: solfeo, claves, notas, compases y símbolos. Funciona sin conexión y guarda tus partituras en tu teléfono.",
  applicationName: "Piano Learn",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Piano Learn",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf7ef" },
    { media: "(prefers-color-scheme: dark)", color: "#141210" },
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
      <body className="min-h-full flex flex-col">
        <AppHeader />
        <main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-4 pb-24 md:pb-10">
          {children}
        </main>
        <AppNav />
      </body>
    </html>
  );
}
