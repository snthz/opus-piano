import Link from "next/link";
import { MetronomePanel } from "@/components/audio/metronome-panel";
import { PageHeader } from "@/components/ui/page-header";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Metrónomo online gratis",
  description:
    "Metrónomo online con tempo de 30 a 240 pulsos por minuto, compases de 2/4 a 7/8, subdivisiones y tempo al toque. Funciona sin conexión y marca el pulso también en pantalla.",
  path: "/metronome",
  keywords: [
    "metrónomo online",
    "metrónomo gratis",
    "metrónomo para piano",
    "tempo bpm",
    "pulsos por minuto",
    "compás musical",
  ],
});

export default function MetronomePage() {
  return (
    <div>
      <PageHeader
        eyebrow="Metrónomo"
        title="Marca el pulso"
        intro="Elige el tempo y el compás y practica a un pulso constante. Suena y se ve, así que también sirve con los cascos quitados."
      />

      <MetronomePanel />

      <section className="mt-8 prose-music text-sm text-ink-2 space-y-3">
        <h2 className="text-base font-semibold text-ink">Cómo sacarle partido</h2>
        <p>
          Empieza despacio: monta el pasaje a un tempo en el que no falles ni una nota y sube de cinco
          en cinco pulsos solo cuando salga limpio dos veces seguidas. Es más rápido que repetirlo
          deprisa y torcido.
        </p>
        <p>
          Si la partitura pide un aire en italiano en lugar de una cifra, elígelo en el desplegable:
          adagio, andante, moderato, allegro, presto… El metrónomo se pone en la velocidad típica de
          ese aire y desde ahí lo ajustas a tu gusto. Son cifras orientativas: cada compositor —y
          cada época— entiende el allegro a su manera.
        </p>
        <p>
          El acento del primer tiempo te sitúa dentro del compás; si aún se te escapa, sube la
          subdivisión para oír lo que hay entre pulso y pulso. Cuando lo lleves interiorizado, baja a
          «Pulso» y luego prueba a marcar solo el primer tiempo.
        </p>
        <p>
          Si quieres medir cómo de a tiempo vas, el{" "}
          <Link href="/practice/rhythm" className="font-semibold text-ink hover:underline">
            ejercicio de ritmo
          </Link>{" "}
          compara tus golpes con el metrónomo y te dice dónde se te va el tiempo. Y si dudas de qué
          significan las cifras del compás, están explicadas en{" "}
          <Link href="/theory/measures" className="font-semibold text-ink hover:underline">
            la lección de compases
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
