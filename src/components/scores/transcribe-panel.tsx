"use client";

import { useEffect, useState } from "react";
import { omrAvailable } from "@/lib/omr/client";
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

/**
 * Sacar el MusicXML de un PDF con el reconocimiento automático del servidor.
 * Es un servicio aparte (ver `omr-service/`) y puede no estar desplegado, así
 * que lo primero es preguntarle al servidor si lo tiene: mientras se comprueba
 * no se enseña nada, que aparezca y desaparezca sería peor que esperar el
 * instante que tarda.
 */
export function TranscribePanel(props: Props) {
  const [omr, setOmr] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    void omrAvailable().then((enabled) => {
      if (alive) setOmr(enabled);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (omr === null) return null;
  if (!omr) {
    return (
      <p className="text-sm text-ink-2 px-1">
        El reconocimiento de partituras no está disponible en este servidor. Puedes vincular un archivo MusicXML que ya tengas desde la
        biblioteca.
      </p>
    );
  }
  return <TranscribeWithOmr {...props} />;
}
