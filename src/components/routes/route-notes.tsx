"use client";

import { useState } from "react";

/**
 * The route's free text — principles, material, rules — shown as light
 * Markdown (## headings, - lists, 1. lists, paragraphs) and edited as plain
 * text. No Markdown library: four line shapes cover what a plan needs.
 */
export function RouteNotes({ notes, onChange }: { notes: string; onChange: (notes: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes);

  if (editing) {
    return (
      <div className="space-y-2">
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={14}
          maxLength={6000}
          className="field h-auto resize-y py-3 text-sm leading-relaxed"
          aria-label="Notas de la ruta"
          placeholder={"## Material\n- Beyer op. 101 · pp. 82–107\n\n## Reglas\n1. Material fácil…"}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              onChange(draft.trim());
              setEditing(false);
            }}
            className="btn-primary text-sm"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(notes);
              setEditing(false);
            }}
            className="btn-secondary text-sm"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {notes ? <NotesView text={notes} /> : <p className="text-sm text-ink-2">Principios, material, reglas de lectura… lo que el plan dice y no cabe en una lista de piezas.</p>}
      <button
        type="button"
        onClick={() => {
          setDraft(notes);
          setEditing(true);
        }}
        className="btn-quiet mt-3 text-xs"
      >
        {notes ? "Editar las notas" : "Escribir notas"}
      </button>
    </div>
  );
}

type Block = { kind: "h"; text: string } | { kind: "ul" | "ol"; items: string[] } | { kind: "p"; text: string };

export function parseNotes(text: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    const ul = /^[-*•]\s+(.*)$/.exec(line);
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    if (h) {
      flush();
      blocks.push({ kind: "h", text: h[1] });
    } else if (ul || ol) {
      flush();
      const kind = ul ? "ul" : "ol";
      const last = blocks[blocks.length - 1];
      const item = (ul ?? ol)![1];
      if (last && last.kind === kind) last.items.push(item);
      else blocks.push({ kind, items: [item] });
    } else para.push(line);
  }
  flush();
  return blocks;
}

function NotesView({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {parseNotes(text).map((b, i) => {
        if (b.kind === "h") return <h3 key={i} className="pt-1 font-semibold tracking-tight">{b.text}</h3>;
        if (b.kind === "p") return <p key={i} className="max-w-prose text-ink-2">{b.text}</p>;
        const Tag = b.kind;
        return (
          <Tag key={i} className={`max-w-prose space-y-1 pl-5 text-ink-2 ${b.kind === "ul" ? "list-disc" : "list-decimal"}`}>
            {b.items.map((it, j) => (
              <li key={j}>{it}</li>
            ))}
          </Tag>
        );
      })}
    </div>
  );
}
