import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { FAQ } from "@/data/faq";
import { faqJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Preguntas frecuentes sobre leer partituras y aprender piano",
  description:
    "Cuánto se tarda en aprender a leer música, en qué se diferencian la clave de sol y la de fa, qué significan los números del compás, si hace falta profesor o piano… respuestas breves y claras.",
  path: "/faq",
  keywords: [
    "cómo aprender a leer partituras",
    "cuánto se tarda en aprender solfeo",
    "diferencia clave de sol y clave de fa",
    "aprender piano sin profesor",
    "preguntas frecuentes música",
  ],
});

/**
 * Página de preguntas frecuentes. El marcado FAQPage permite que Google muestre
 * las preguntas desplegables bajo el resultado, y cada respuesta está escrita
 * para entenderse suelta, fuera de la página.
 */
export default function FaqPage() {
  return (
    <div>
      <JsonLd data={faqJsonLd(FAQ)} />
      <Breadcrumbs items={[{ name: "Preguntas frecuentes", path: "/faq" }]} />
      <PageHeader
        eyebrow="Preguntas frecuentes"
        title="Dudas al empezar con la música"
        intro="Lo que casi todo el mundo se pregunta antes de la primera lección: cuánto cuesta, por dónde se empieza y qué hace falta para practicar."
      />

      <div className="space-y-3">
        {FAQ.map((item) => (
          <article key={item.question} className="card p-5">
            <h2 className="font-semibold text-lg tracking-tight leading-snug">{item.question}</h2>
            <p className="mt-2 text-ink-2 leading-relaxed">{item.answer}</p>
            {item.link && (
              <Link href={item.link.href} className="inline-block mt-3 text-sm text-accent underline underline-offset-2 decoration-ink-3 hover:decoration-ink transition-colors">
                {item.link.label} →
              </Link>
            )}
          </article>
        ))}
      </div>

      <section className="mt-10 card-pastel bg-ash p-6">
        <h2 className="text-xl font-semibold tracking-tight">¿Empezamos?</h2>
        <p className="mt-2 text-ink-2 leading-relaxed">
          La primera lección son seis minutos y no hace falta instrumento.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/theory/staff" className="pill pill-active text-sm">
            Primera lección
          </Link>
          <Link href="/guide" className="pill text-sm">
            Ver la guía completa
          </Link>
        </div>
      </section>
    </div>
  );
}
