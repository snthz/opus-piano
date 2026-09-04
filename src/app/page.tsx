import Link from "next/link";

const modules = [
  {
    href: "/teoria",
    title: "Teoría",
    text: "Pentagrama, claves, notas, figuras, compases, símbolos y tonalidades explicados paso a paso.",
    glyph: "",
  },
  {
    href: "/practica",
    title: "Práctica",
    text: "Ejercicios de lectura de notas, ritmo, solfeo y reconocimiento de símbolos con seguimiento de progreso.",
    glyph: "",
  },
  {
    href: "/partituras",
    title: "Mis partituras",
    text: "Sube tus PDF desde el teléfono. Se guardan solo en este dispositivo y se pueden leer sin conexión.",
    glyph: "",
  },
];

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="pt-4">
        <p className="text-sm uppercase tracking-widest text-ink-3 font-medium">
          Aprende piano en español
        </p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
          Lee partituras y toca el piano, a tu ritmo.
        </h1>
        <p className="mt-3 text-ink-2 leading-relaxed">
          Material completo para aprender a leer música desde cero: solfeo, claves, notas,
          compases y todos los símbolos de la partitura, con los glifos originales del estándar
          SMuFL. Todo funciona sin conexión.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="card p-4 flex sm:flex-col gap-4 hover:border-accent/60 transition-colors"
          >
            <span className="smufl text-4xl text-accent shrink-0 w-12 text-center" aria-hidden="true">
              {m.glyph}
            </span>
            <span>
              <span className="block font-semibold">{m.title}</span>
              <span className="block text-sm text-ink-2 mt-1">{m.text}</span>
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
