"use client";

import { useRef, useState } from "react";
import { updateScoreNotes, type ScoreRecord } from "@/lib/scores-db";
import type { PlanState } from "@/lib/study-plan";
import { useJob } from "@/lib/jobs";
import { ChevronIcon } from "@/components/ui/arrow-icon";
import { Sheet } from "@/components/ui/sheet";
import { JobIndicator } from "./job-indicator";
import { MusicXmlViewer } from "./musicxml-viewer";
import { PdfReader } from "./pdf-reader";
import { StudyPlanPanel } from "./study-plan";

interface Props {
  record: ScoreRecord;
  onClose: () => void;
  onDelete: () => void;
  onNotesChange: (notes: string) => void;
  onRename: (name: string) => void;
  onPlanChange: (plan: PlanState | undefined) => void;
}

/** PDF: lector a pantalla completa. MusicXML: partitura dibujada dentro de la página. */
export function ScoreViewer(props: Props) {
  if (props.record.kind !== "musicxml") return <PdfReader {...props} />;
  return <XmlPage {...props} />;
}

function XmlPage({ record, onClose, onDelete, onNotesChange, onPlanChange }: Props) {
  const [notes, setNotes] = useState(record.notes);
  const [showNotes, setShowNotes] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const planJob = useJob("plan", record.id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveNotes = (v: string) => {
    setNotes(v);
    onNotesChange(v);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void updateScoreNotes(record.id, v), 800);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onClose} className="btn-circle w-10 h-10" aria-label="Volver">
          <ChevronIcon dir="left" className="w-5 h-5" />
        </button>
        <h1 className="font-bold truncate flex-1 min-w-0">{record.name}</h1>
        {planJob && <JobIndicator job={planJob} onOpen={() => setShowPlan(true)} />}
        <button type="button" onClick={() => setShowPlan((v) => !v)} className={`pill text-xs py-1.5 ${showPlan ? "pill-active" : ""}`}>
          Plan{record.plan ? " ✓" : ""}
        </button>
        <button type="button" onClick={() => setShowNotes((v) => !v)} className={`pill text-xs py-1.5 ${showNotes ? "pill-active" : ""}`}>
          Notas
        </button>
        {!confirmDelete ? (
          <button type="button" onClick={() => setConfirmDelete(true)} className="text-xs text-bad hover:underline">Eliminar</button>
        ) : (
          <span className="flex items-center gap-2 text-xs">
            <span className="text-bad font-semibold">¿Seguro?</span>
            <button type="button" onClick={onDelete} className="text-bad underline">Sí</button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="text-ink-2 underline">No</button>
          </span>
        )}
      </div>

      {showNotes && (
        <textarea
          value={notes}
          onChange={(e) => saveNotes(e.target.value)}
          placeholder="Escribe aquí tus notas personales sobre esta partitura…"
          rows={4}
          className="w-full rounded-2xl px-4 py-3 text-sm bg-surface border border-surface-3 focus:outline-none focus:border-accent resize-none"
        />
      )}

      <MusicXmlViewer file={record.file} />

      {/* El plan se abre como hoja sobre la partitura, igual que en el lector de PDF. */}
      <Sheet open={showPlan} onClose={() => setShowPlan(false)} title="Plan de estudio" subtitle={record.name}>
        <StudyPlanPanel record={record} xml={record.file} onPlanChange={onPlanChange} />
      </Sheet>
    </div>
  );
}
