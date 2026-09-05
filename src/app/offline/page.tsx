import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Sin conexión" };

export default function OfflinePage() {
  return (
    <div>
      <PageHeader
        eyebrow="Sin conexión"
        title="Esta página no está guardada"
        intro="No hay conexión y esta parte de Opus Piano todavía no se había descargado en tu dispositivo."
      />
      <div className="card p-5">
        <p className="text-sm text-ink-2">
          Las lecciones y ejercicios que ya has visitado siguen disponibles sin conexión.
          Vuelve a intentarlo cuando tengas red.
        </p>
        <Link href="/" className="pill pill-active inline-flex mt-4 text-sm">
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
