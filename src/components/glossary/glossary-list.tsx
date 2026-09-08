"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GlyphIcon } from "@/components/notation/glyph-icon";
import { GLOSSARY, glossarySlug, groupByLetter } from "@/data/glossary";
import { normalizePath } from "@/lib/routes";

/** Quita tildes para que la búsqueda funcione escribiendo "compas" o "compás". */
function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function GlossaryList() {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = fold(query.trim());
    const filtered = q
      ? GLOSSARY.filter((e) => fold(e.term).includes(q) || fold(e.definition).includes(q))
      : GLOSSARY;
    return groupByLetter(filtered);
  }, [query]);

  const letters = useMemo(() => groupByLetter(GLOSSARY).map(([l]) => l), []);
  const available = new Set(groups.map(([l]) => l));

  return (
    <div className="space-y-5">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar un término…"
        className="w-full rounded-2xl px-4 py-2.5 bg-surface border border-surface-3 text-sm focus:outline-none focus:border-accent"
      />

      <nav className="flex flex-wrap gap-1" aria-label="Índice alfabético">
        {letters.map((l) => (
          <a
            key={l}
            href={`#letra-${l}`}
            aria-disabled={!available.has(l)}
            className={`w-8 h-8 grid place-items-center rounded-full text-xs font-semibold transition-colors ${
              available.has(l) ? "bg-surface-2 hover:bg-ash" : "text-ink-3 pointer-events-none opacity-40"
            }`}
          >
            {l}
          </a>
        ))}
      </nav>

      {groups.length === 0 && (
        <p className="text-sm text-ink-2 text-center py-8">Sin resultados para «{query}».</p>
      )}

      {groups.map(([letter, entries]) => (
        <section key={letter} id={`letra-${letter}`} className="scroll-mt-20">
          <h2 className="text-sm font-bold text-ink-2 mb-2 sticky top-[var(--header-h)] bg-bg/90 backdrop-blur py-1">{letter}</h2>
          <ul className="space-y-2">
            {entries.map((e) => (
              <li key={e.term} className="card p-4 flex gap-3 items-start">
                {e.glyph && (
                  <span className="shrink-0 w-8 text-center text-ink-2">
                    <GlyphIcon name={e.glyph} size={26} />
                  </span>
                )}
                <div className="min-w-0">
                  {/* El título enlaza a su ficha: es lo que hace rastreables las
                      53 páginas del glosario desde una sola página índice. */}
                  <h3 className="font-semibold text-sm">
                    <Link href={`/glossary/${glossarySlug(e.term)}`} className="hover:text-accent transition-colors">
                      {e.term}
                    </Link>
                  </h3>
                  <p className="text-sm text-ink-2 mt-0.5">{e.definition}</p>
                  {e.href && (
                    <Link href={normalizePath(e.href)} className="text-xs text-accent underline underline-offset-2 decoration-ink-3 hover:decoration-ink transition-colors mt-1 inline-block">
                      Ver la lección →
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
