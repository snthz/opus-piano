/**
 * Anillo de progreso. Con `progress` entre 0 y 1 pinta el arco hecho; con
 * `null` gira sin parar (se está esperando a algo que no avisa de su avance).
 * Al acabar enseña una marca, y si ha fallado, un aviso. Se dibuja con
 * `currentColor`, así que el color lo decide quien lo usa.
 */
export function ProgressRing({
  progress,
  status = "running",
  className = "",
  stroke = 3,
}: {
  progress: number | null;
  status?: "running" | "done" | "error";
  className?: string;
  /** Grosor del trazo en unidades del viewBox (36) */
  stroke?: number;
}) {
  const r = 18 - stroke / 2 - 1;
  const c = 2 * Math.PI * r;
  const spinning = status === "running" && progress === null;
  const fraction = status === "done" ? 1 : Math.max(0, Math.min(1, progress ?? 0));

  return (
    // El giro va en el <svg>, no en el arco: al animar `transform` sobre un
    // elemento SVG interior, Chrome lo rota fuera de su sitio y el anillo acaba
    // pareciendo una lupa.
    <svg viewBox="0 0 36 36" className={`${className} ${spinning ? "animate-spin" : ""}`} aria-hidden="true">
      <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeWidth={stroke} opacity={0.18} />
      {status !== "error" && (
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={spinning ? c * 0.72 : c * (1 - fraction)}
          transform="rotate(-90 18 18)"
          className={spinning ? "" : "transition-[stroke-dashoffset] duration-500 ease-out"}
        />
      )}
      {status === "done" && <path d="M11.5 18.5l4.2 4.2 8.8-9.4" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />}
      {status === "error" && (
        <>
          <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeWidth={stroke} />
          <path d="M18 10.5v9" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
          <circle cx="18" cy="24.5" r={stroke / 2 + 0.4} fill="currentColor" />
        </>
      )}
    </svg>
  );
}
