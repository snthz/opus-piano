"use client";

import { useMemo, useState } from "react";
import { GlyphIcon } from "./glyph-icon";
import { SYMBOL_CATEGORIES, type SymbolEntry } from "@/data/symbols";

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function SymbolCard({ s, compact = false }: { s: SymbolEntry; compact?: boolean }) {
  const glyphs = [s.glyph, ...(s.extraGlyphs ?? [])];
  return (
    // El id hace que cada símbolo tenga su propio enlace («…/symbols/dynamics#forte»),
    // que es lo que se puede citar; sin él solo se puede enlazar la familia entera.
    <div id={s.id} className="card p-4 flex gap-4 scroll-mt-24">
      <div className="w-20 h-20 rounded-2xl bg-surface-2 flex items-center justify-center shrink-0 overflow-hidden">
        <GlyphIcon name={glyphs} size={44 * (s.scale ?? 1)} fit="em" label={s.name} />
      </div>
      <div className="min-w-0">
        <h3 className="font-semibold leading-tight">{s.name}</h3>
        {s.alt && s.alt.length > 0 && <p className="text-xs text-ink-3 mt-0.5">{s.alt.join(" · ")}</p>}
        {!compact && <p className="text-sm text-ink-2 mt-2 leading-relaxed">{s.meaning}</p>}
        {!compact && s.tip && <p className="text-sm mt-2 font-medium text-ink">Al piano: {s.tip}</p>}
      </div>
    </div>
  );
}

export function SymbolCatalog() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("todos");

  const results = useMemo(() => {
    const q = normalize(query.trim());
    return SYMBOL_CATEGORIES.filter((c) => category === "todos" || c.id === category)
      .map((c) => ({
        ...c,
        items: c.items.filter(
          (s) =>
            !q ||
            normalize(s.name).includes(q) ||
            (s.alt ?? []).some((a) => normalize(a).includes(q)) ||
            normalize(s.meaning).includes(q),
        ),
      }))
      .filter((c) => c.items.length > 0);
  }, [query, category]);

  return (
    <div className="space-y-5">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar símbolo… (p. ej. staccato, bemol, coda)"
        className="w-full card px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/40 bg-surface"
        aria-label="Buscar símbolo"
      />
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:none]">
        <button type="button" onClick={() => setCategory("todos")} className={`pill shrink-0 ${category === "todos" ? "pill-active" : ""}`}>
          Todos
        </button>
        {SYMBOL_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`pill shrink-0 ${category === c.id ? "pill-active" : ""}`}
          >
            {c.title}
          </button>
        ))}
      </div>

      {results.length === 0 && <p className="text-ink-2 text-sm">No hay símbolos que coincidan con «{query}».</p>}

      {results.map((c) => (
        <section key={c.id} id={`sim-${c.id}`} className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{c.title}</h2>
            <p className="text-sm text-ink-2 mt-1">{c.intro}</p>
          </div>
          <div className="grid gap-3">
            {c.items.map((s) => (
              <SymbolCard key={s.id} s={s} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
