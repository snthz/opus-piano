import { keysWithFifths, keyName } from "@/lib/music/keys";

/**
 * Círculo de quintas en SVG: tonalidades mayores fuera, relativas menores dentro,
 * número de alteraciones en el centro de cada sector.
 */
export function CircleOfFifths({ size = 340 }: { size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.46;
  const rMajor = size * 0.38;
  const rMinor = size * 0.26;
  const rAcc = size * 0.15;
  const pos = (i: number, r: number) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  // Posiciones 0..11 en sentido horario: C, G, D, A, E, B, F#/Gb, Db, Ab, Eb, Bb, F
  const fifthsAt = [0, 1, 2, 3, 4, 5, 6, -5, -4, -3, -2, -1];
  const enharmonicAt: Record<number, string> = { 5: "Do♭", 6: "Sol♭", 7: "Do♯" };

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-sm mx-auto" role="img" aria-label="Círculo de quintas">
      <circle cx={cx} cy={cy} r={rOuter} fill="var(--surface)" stroke="var(--line)" />
      <circle cx={cx} cy={cy} r={size * 0.32} fill="none" stroke="var(--line)" />
      <circle cx={cx} cy={cy} r={size * 0.2} fill="var(--surface-2)" stroke="var(--line)" />
      {fifthsAt.map((f, i) => {
        const { major, minor } = keysWithFifths(f);
        const pMaj = pos(i, rMajor);
        const pMin = pos(i, rMinor);
        const pAcc = pos(i, rAcc);
        const accText = f === 0 ? "–" : f > 0 ? `${f}♯` : `${-f}♭`;
        const enh = enharmonicAt[i];
        return (
          <g key={i}>
            <text x={pMaj.x} y={pMaj.y} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.045} fontWeight={600} fill="var(--ink)">
              {keyName(major).replace(" mayor", "")}
            </text>
            {enh && (
              <text x={pMaj.x} y={pMaj.y + size * 0.045} textAnchor="middle" fontSize={size * 0.03} fill="var(--ink-3)">
                {enh}
              </text>
            )}
            <text x={pMin.x} y={pMin.y} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.036} fill="var(--ink-2)">
              {keyName(minor).replace(" menor", "m")}
            </text>
            <text x={pAcc.x} y={pAcc.y} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.03} fill="var(--accent)" fontWeight={600}>
              {accText}
            </text>
          </g>
        );
      })}
      <text x={cx} y={cy - size * 0.01} textAnchor="middle" fontSize={size * 0.03} fill="var(--ink-3)">
        mayor
      </text>
      <text x={cx} y={cy + size * 0.035} textAnchor="middle" fontSize={size * 0.03} fill="var(--ink-3)">
        menor
      </text>
    </svg>
  );
}
