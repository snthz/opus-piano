"use client";

import { useEffect, useState } from "react";
import { getJob } from "@/lib/jobs";
import { omrAvailable } from "@/lib/omr/client";
import { TranscribeWithAi } from "./transcribe-ai";
import { TranscribeWithOmr } from "./transcribe-omr";

interface Props {
  scoreId: string;
  scoreName: string;
  pdf: Blob;
  pageCount: number;
  /** Ya hay un MusicXML vinculado: usarlo lo sustituye */
  hasXml: boolean;
  onUse: (xml: string) => void | Promise<void>;
}

type Method = "omr" | "ai";

/**
 * Sacar el MusicXML de un PDF, por los dos caminos que tiene Opus Piano: el
 * reconocimiento automático del servidor (gratis, pero lento y solo con
 * partituras impresas) y un modelo de visión con la clave del usuario (cuesta
 * dinero y se defiende mejor con lo difícil). Sale el mismo tipo de archivo y
 * se revisa igual, así que se eligen aquí, uno al lado del otro.
 *
 * Si el servidor no tiene configurado el servicio de reconocimiento, no se
 * ofrece y el panel es directamente el de la IA.
 */
export function TranscribePanel({ scoreId, scoreName, pdf, pageCount, hasXml, onUse }: Props) {
  const [omr, setOmr] = useState<boolean | null>(null);
  // La tarea que ya estuviera en marcha manda sobre la pestaña que se abre.
  const [method, setMethod] = useState<Method>(() => (getJob("transcribe", scoreId) && !getJob("omr", scoreId) ? "ai" : "omr"));

  useEffect(() => {
    let alive = true;
    void omrAvailable().then((enabled) => {
      if (alive) setOmr(enabled);
    });
    return () => {
      alive = false;
    };
  }, []);

  const parts = { scoreId, scoreName, pdf, pageCount, hasXml, onUse };
  // Mientras se comprueba (null) tampoco se enseñan pestañas: que aparezcan y
  // desaparezcan sería peor que esperar el instante que tarda.
  if (!omr) return <TranscribeWithAi {...parts} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1" role="tablist" aria-label="Cómo transcribir">
        <Tab active={method === "omr"} onClick={() => setMethod("omr")}>
          Automática · gratis
        </Tab>
        <Tab active={method === "ai"} onClick={() => setMethod("ai")}>
          Con IA · de pago
        </Tab>
      </div>
      {method === "omr" ? <TranscribeWithOmr {...parts} /> : <TranscribeWithAi {...parts} />}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`pill text-xs py-1.5 ${active ? "pill-active" : ""}`}>
      {children}
    </button>
  );
}
