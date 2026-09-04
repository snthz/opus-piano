import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Más" };

const links = [
  { href: "/glosario", title: "Glosario", text: "Términos musicales de la A a la Z." },
  { href: "/ajustes", title: "Ajustes", text: "Nombres de notas, sonido y datos guardados." },
];

export default function MasPage() {
  return (
    <div>
      <PageHeader eyebrow="Más" title="Recursos y ajustes" />
      <ul className="grid gap-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="card p-4 block hover:border-accent/60 transition-colors">
              <span className="font-semibold">{l.title}</span>
              <span className="block text-sm text-ink-2 mt-0.5">{l.text}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-xs text-ink-3">
        Piano Learn es software libre (MIT). Fuentes musicales Bravura y Academico de Steinberg
        bajo licencia SIL OFL 1.1.
      </p>
    </div>
  );
}
