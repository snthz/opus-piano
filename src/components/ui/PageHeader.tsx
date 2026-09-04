import Link from "next/link";

export function PageHeader({
  eyebrow,
  title,
  intro,
  back,
}: {
  eyebrow?: string;
  title: string;
  intro?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-6">
      {back && (
        <Link href={back.href} className="text-sm text-accent hover:underline">
          ← {back.label}
        </Link>
      )}
      {eyebrow && (
        <p className="mt-2 text-xs uppercase tracking-widest text-ink-3 font-medium">{eyebrow}</p>
      )}
      <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
      {intro && <p className="mt-2 text-ink-2 leading-relaxed">{intro}</p>}
    </header>
  );
}
