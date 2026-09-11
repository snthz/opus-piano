/**
 * Ilustraciones de la lección de postura.
 *
 * Son SVG en línea, no imágenes: siguen la paleta del tema (claro y oscuro),
 * se ven nítidas a cualquier tamaño y viajan dentro del bundle, así que la
 * lección se lee igual sin conexión. Los puntos numerados del dibujo se
 * explican en una lista aparte —exportada aquí al lado— para que el texto sea
 * legible en un móvil y lo lea un lector de pantalla.
 */

const INK = "var(--ink)";
const SOFT = "var(--ink-3)";
const FURNITURE = "var(--surface-3)";
const PANEL = "var(--surface-2)";
const SKIN = "var(--surface)";

const DASH = "5 4";

export interface FigurePoint {
  n: number;
  title: string;
  text: string;
}

/** Número del dibujo: círculo de tinta con la cifra en el color del fondo. */
function Badge({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={9.5} fill={INK} />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={700}
        fill="var(--bg)"
        fontFamily="var(--font-sans)"
      >
        {n}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Vista de perfil: la postura completa
// ---------------------------------------------------------------------------

export const SEATED_POINTS: FigurePoint[] = [
  {
    n: 1,
    title: "En la mitad delantera de la banqueta",
    text: "Solo la mitad del muslo apoyada. Sentarse hasta el fondo bloquea la cadera y obliga a la espalda a compensar.",
  },
  {
    n: 2,
    title: "Espalda larga, hombros bajos",
    text: "Recta pero no rígida, con un ligero peso hacia delante desde la cadera. Los hombros caen; no suben hacia las orejas.",
  },
  {
    n: 3,
    title: "Codos algo por delante del cuerpo",
    text: "El ángulo del codo ronda los 90°, y el antebrazo queda horizontal, a la altura de las teclas.",
  },
  {
    n: 4,
    title: "Muñeca a la altura del dorso",
    text: "Antebrazo, muñeca y nudillos forman una línea. La mano cuelga del brazo, no se apoya en la madera.",
  },
  {
    n: 5,
    title: "Pies apoyados en el suelo",
    text: "Planos y separados, el derecho cerca del pedal. Son los que sostienen el equilibrio cuando el cuerpo se mueve.",
  },
];

export function SeatedPostureFigure({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 340 230"
      role="img"
      aria-label="Vista de perfil de una persona sentada al piano: banqueta a media altura, espalda recta, antebrazos horizontales a la altura de las teclas y pies apoyados en el suelo."
      className={`w-full ${className}`}
    >
      {/* Suelo */}
      <line x1={12} y1={206} x2={328} y2={206} stroke={SOFT} strokeWidth={1.5} />

      {/* Piano: caja, atril, teclado y pata */}
      <rect x={258} y={52} width={68} height={60} rx={4} fill={PANEL} stroke={SOFT} strokeWidth={1.5} />
      <line x1={274} y1={52} x2={286} y2={32} stroke={SOFT} strokeWidth={3} strokeLinecap="round" />
      <rect x={236} y={112} width={90} height={9} rx={2} fill={FURNITURE} stroke={SOFT} strokeWidth={1.5} />
      <rect x={300} y={121} width={9} height={85} fill={PANEL} stroke={SOFT} strokeWidth={1.5} />

      {/* Banqueta */}
      <rect x={96} y={146} width={88} height={9} rx={2} fill={FURNITURE} stroke={SOFT} strokeWidth={1.5} />
      <line x1={106} y1={155} x2={106} y2={206} stroke={SOFT} strokeWidth={4} strokeLinecap="round" />
      <line x1={176} y1={155} x2={176} y2={206} stroke={SOFT} strokeWidth={4} strokeLinecap="round" />

      {/* Referencia: el antebrazo va al nivel de las teclas */}
      <line x1={140} y1={113} x2={332} y2={113} stroke={SOFT} strokeWidth={1.5} strokeDasharray={DASH} />

      <g stroke={INK} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Pierna */}
        <path d="M160 144 L206 150 L212 199" />
        <path d="M206 203 L238 203" />
        {/* Columna y cuello */}
        <path d="M160 144 C164 124 170 108 176 92" strokeWidth={5} />
        <path d="M176 92 L181 83" />
        {/* Brazo: hombro, codo y antebrazo horizontal */}
        <path d="M176 94 L186 126 L232 115" />
      </g>
      <circle cx={176} cy={93} r={3.5} fill={INK} />

      {/* Escuadra del codo: el ángulo que se busca */}
      <polyline
        points="195.8,124.5 192.4,117.2 182.6,117.4"
        fill="none"
        stroke={SOFT}
        strokeWidth={1.5}
      />

      {/* Mano sobre las teclas */}
      <rect x={228} y={106} width={20} height={11} rx={5.5} fill={SKIN} stroke={INK} strokeWidth={2} />

      {/* Cabeza */}
      <circle cx={187} cy={72} r={13} fill={SKIN} stroke={INK} strokeWidth={3} />

      <Badge x={132} y={132} n={1} />
      <Badge x={146} y={92} n={2} />
      <Badge x={200} y={137} n={3} />
      <Badge x={242} y={88} n={4} />
      <Badge x={228} y={184} n={5} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Altura de la banqueta: demasiado baja, correcta, demasiado alta
// ---------------------------------------------------------------------------

type Height = "low" | "ok" | "high";

const BENCH: Record<Height, { seat: number; shoulder: number; elbow: number }> = {
  low: { seat: 112, shoulder: 66, elbow: 92 },
  ok: { seat: 94, shoulder: 48, elbow: 68 },
  high: { seat: 74, shoulder: 28, elbow: 46 },
};

/** Perfil reducido a lo que importa: dónde queda el codo respecto a las teclas. */
export function BenchHeightFigure({ variant, className = "" }: { variant: Height; className?: string }) {
  const { seat, shoulder, elbow } = BENCH[variant];
  const tone = variant === "ok" ? "var(--ok)" : "var(--bad)";
  const label =
    variant === "ok"
      ? "Banqueta a la altura correcta: el antebrazo queda horizontal sobre las teclas."
      : variant === "low"
        ? "Banqueta demasiado baja: el antebrazo sube hacia las teclas y la muñeca se hunde."
        : "Banqueta demasiado alta: el antebrazo baja hacia las teclas y los hombros se encogen.";

  return (
    <svg viewBox="0 0 170 150" role="img" aria-label={label} className={`w-full ${className}`}>
      {/* Suelo y teclado (fijos: lo único que cambia es la altura del asiento) */}
      <line x1={10} y1={138} x2={166} y2={138} stroke={SOFT} strokeWidth={1.5} />
      <rect x={104} y={70} width={60} height={9} rx={2} fill={FURNITURE} stroke={SOFT} strokeWidth={1.5} />
      <line x1={20} y1={70} x2={166} y2={70} stroke={SOFT} strokeWidth={1.5} strokeDasharray={DASH} />

      {/* Banqueta */}
      <rect x={18} y={seat} width={54} height={7} rx={2} fill={FURNITURE} stroke={SOFT} strokeWidth={1.5} />
      <line x1={26} y1={seat + 7} x2={26} y2={138} stroke={SOFT} strokeWidth={3} strokeLinecap="round" />
      <line x1={64} y1={seat + 7} x2={64} y2={138} stroke={SOFT} strokeWidth={3} strokeLinecap="round" />

      <g stroke={INK} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d={`M56 ${seat} L94 ${seat + 4} L102 138`} />
        <path d={`M56 ${seat} L66 ${shoulder}`} strokeWidth={4.5} />
        <path d={`M66 ${shoulder} L80 ${elbow}`} />
      </g>
      {/* El antebrazo: el trazo que delata si la altura es la buena */}
      <path d={`M80 ${elbow} L112 66`} fill="none" stroke={tone} strokeWidth={4} strokeLinecap="round" />
      <rect x={108} y={61} width={18} height={10} rx={5} fill={SKIN} stroke={INK} strokeWidth={2} />
      <circle cx={70} cy={shoulder - 10} r={8} fill={SKIN} stroke={INK} strokeWidth={2.5} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Vista desde arriba: centrado y distancia
// ---------------------------------------------------------------------------

export const TOP_POINTS: FigurePoint[] = [
  {
    n: 1,
    title: "Centrado en el teclado",
    text: "El ombligo frente al centro del teclado, más o menos a la altura del do central. Desde ahí las dos manos llegan igual de lejos.",
  },
  {
    n: 2,
    title: "A un brazo de distancia",
    text: "Con los brazos estirados y relajados, los nudillos deberían rozar el atril. Si estás más cerca, los codos se quedan sin sitio.",
  },
];

const WHITE_KEYS = 21;
const KEY_W = 12;
const KEY_X0 = 24;

export function KeyboardTopFigure({ className = "" }: { className?: string }) {
  const width = WHITE_KEYS * KEY_W;
  const center = KEY_X0 + width / 2;
  return (
    <svg
      viewBox="0 0 300 184"
      role="img"
      aria-label="Vista desde arriba: la banqueta centrada frente al centro del teclado y a la distancia de un brazo estirado."
      className={`w-full ${className}`}
    >
      {/* Teclado visto desde arriba */}
      <rect x={KEY_X0} y={20} width={width} height={44} rx={2} fill={SKIN} stroke={SOFT} strokeWidth={1.5} />
      {Array.from({ length: WHITE_KEYS - 1 }, (_, i) => (
        <line
          key={`w${i}`}
          x1={KEY_X0 + KEY_W * (i + 1)}
          y1={20}
          x2={KEY_X0 + KEY_W * (i + 1)}
          y2={64}
          stroke={SOFT}
          strokeWidth={1}
        />
      ))}
      {Array.from({ length: WHITE_KEYS - 1 }, (_, i) =>
        [0, 1, 3, 4, 5].includes(i % 7) ? (
          <rect
            key={`b${i}`}
            x={KEY_X0 + KEY_W * (i + 1) - 4}
            y={20}
            width={8}
            height={26}
            rx={1}
            fill="var(--ink-2)"
          />
        ) : null,
      )}

      {/* Eje: el centro del teclado, el de la banqueta y el del cuerpo son el mismo */}
      <line x1={center} y1={12} x2={center} y2={180} stroke={SOFT} strokeWidth={1.5} strokeDasharray={DASH} />

      {/* Banqueta */}
      <rect x={center - 46} y={140} width={92} height={30} rx={3} fill={FURNITURE} stroke={SOFT} strokeWidth={1.5} />

      {/* Persona desde arriba: hombros, brazos y manos sobre las teclas */}
      <g fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round">
        <path d="M130 130 C120 104 118 80 124 64" />
        <path d="M170 130 C180 104 182 80 176 64" />
      </g>
      <rect x={center - 22} y={126} width={44} height={30} rx={13} fill={PANEL} stroke={INK} strokeWidth={3} />
      <circle cx={center} cy={114} r={12} fill={SKIN} stroke={INK} strokeWidth={3} />
      <rect x={116} y={50} width={17} height={15} rx={6} fill={SKIN} stroke={INK} strokeWidth={2} />
      <rect x={167} y={50} width={17} height={15} rx={6} fill={SKIN} stroke={INK} strokeWidth={2} />

      {/* Cota de la distancia entre la banqueta y el teclado */}
      <g stroke={SOFT} strokeWidth={1.5} fill="none">
        <line x1={248} y1={68} x2={248} y2={138} strokeDasharray={DASH} />
        <polyline points="244,73 248,66 252,73" />
        <polyline points="244,133 248,140 252,133" />
      </g>

      <Badge x={center} y={84} n={1} />
      <Badge x={270} y={103} n={2} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// La mano de perfil: el arco
// ---------------------------------------------------------------------------

export const HAND_POINTS: FigurePoint[] = [
  {
    n: 1,
    title: "Línea recta hasta los nudillos",
    text: "Antebrazo, muñeca y dorso de la mano a la misma altura. Ni un escalón hacia arriba ni hacia abajo.",
  },
  {
    n: 2,
    title: "Nudillos altos: el arco",
    text: "Los nudillos son el techo de la mano y no se hunden. Debajo cabe una pelota pequeña.",
  },
  {
    n: 3,
    title: "Dedos curvos, se toca con la yema",
    text: "Cada dedo dibuja una curva y llega a la tecla por la yema, con la uña corta y la última falange firme.",
  },
  {
    n: 4,
    title: "El pulgar, de canto",
    text: "Toca con el lateral de la punta y se queda cerca de la tecla, ni colgando por debajo ni tieso hacia fuera.",
  },
];

/**
 * Silueta del antebrazo, la mano y el dedo de perfil, en un solo trazado
 * cerrado: la muñeca se estrecha, el dorso sube hasta el nudillo y el dedo
 * baja en curva hasta apoyar la yema en la tecla, con el pulgar delante.
 */
const ARCH_SILHOUETTE =
  "M4 56 C40 55 72 57 92 58 C104 58 112 53 124 49 C136 45 146 44 152 47 " +
  "C168 52 178 68 180 86 C181 100 178 112 174 120 C171 127 162 128 158 122 " +
  "C156 116 160 106 160 98 C160 86 152 74 142 70 C136 68 130 70 124 74 " +
  "C120 86 116 104 116 118 C116 126 106 128 102 121 C100 110 102 94 104 82 " +
  "C100 78 96 77 92 78 C72 79 40 79 4 78 Z";

/** El dedo de al lado, un poco más atrás y más alto: solo asoma por detrás. */
const ARCH_BACK_FINGER =
  "M158 40 C176 44 190 60 194 78 C196 92 192 106 188 112 C184 119 174 119 170 114 " +
  "C168 108 174 98 174 90 C174 78 166 66 156 62 Z";

export function HandArchFigure({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 270 170"
      role="img"
      aria-label="Mano de perfil sobre las teclas: la muñeca alineada con el antebrazo, los nudillos altos formando un arco y los dedos curvos tocando con la yema."
      className={`w-full ${className}`}
    >
      {/* Teclas de perfil: la blanca delante, la negra detrás y más alta */}
      <rect x={24} y={126} width={234} height={18} rx={3} fill={PANEL} stroke={SOFT} strokeWidth={1.5} />
      <rect x={204} y={110} width={52} height={16} rx={2} fill="var(--ink-2)" />

      {/* La pelota que cabe bajo el arco */}
      <circle cx={140} cy={100} r={19} fill="none" stroke={SOFT} strokeWidth={1.5} strokeDasharray={DASH} />

      <path d={ARCH_BACK_FINGER} fill={FURNITURE} stroke={SOFT} strokeWidth={1.5} strokeLinejoin="round" />
      <path d={ARCH_SILHOUETTE} fill={PANEL} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />

      {/* Pliegues: muñeca, nudillo, articulaciones del dedo y uña */}
      <g fill="none" stroke={INK} strokeWidth={1.2} strokeLinecap="round" opacity={0.55}>
        <path d="M95 61 Q98 68 95 75" />
        <path d="M146 49 Q150 52 152 56" />
        <path d="M176 78 Q180 82 179 90" />
        <path d="M176 110 Q178 114 173 119" />
        <path d="M112 112 Q116 116 114 121" />
      </g>
      <path d="M162 120 Q168 125 172 119" fill="none" stroke={INK} strokeWidth={1.2} strokeLinecap="round" />

      {/* Alineación antebrazo–muñeca–nudillos */}
      <line x1={12} y1={67} x2={146} y2={56} stroke={SOFT} strokeWidth={1.5} strokeDasharray={DASH} />

      <Badge x={72} y={38} n={1} />
      <Badge x={156} y={26} n={2} />
      <Badge x={214} y={96} n={3} />
      <Badge x={86} y={110} n={4} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// La muñeca: hundida, alineada, levantada
// ---------------------------------------------------------------------------

const WRIST_Y: Record<Height, number> = { low: 70, ok: 50, high: 30 };

export function WristFigure({ variant, className = "" }: { variant: Height; className?: string }) {
  const y = WRIST_Y[variant];
  const tone = variant === "ok" ? "var(--ok)" : "var(--bad)";
  const label =
    variant === "ok"
      ? "Muñeca alineada: el antebrazo y el dorso de la mano forman una sola línea."
      : variant === "low"
        ? "Muñeca hundida por debajo de los nudillos."
        : "Muñeca levantada por encima de los nudillos.";

  // Antebrazo y mano son dos tramos rectos que se quiebran solo en la muñeca
  // (x=68), como la articulación real; el dedo baja en curva hasta la tecla.
  const silhouette =
    `M6 41 L68 ${y - 9} L104 44 ` +
    "C118 44 128 56 128 70 C128 80 126 86 122 88 C116 88 114 80 114 72 " +
    `C114 62 108 58 100 60 L68 ${y + 9} L6 59 Z`;

  return (
    <svg viewBox="0 0 160 110" role="img" aria-label={label} className={`w-full ${className}`}>
      <rect x={68} y={84} width={86} height={12} rx={3} fill={PANEL} stroke={SOFT} strokeWidth={1.5} />
      <line x1={8} y1={50} x2={150} y2={50} stroke={SOFT} strokeWidth={1.5} strokeDasharray={DASH} />
      <path d={silhouette} fill={PANEL} stroke={tone} strokeWidth={2.5} strokeLinejoin="round" />
      {/* Pliegue de la muñeca y del nudillo */}
      <g fill="none" stroke={INK} strokeWidth={1.2} strokeLinecap="round" opacity={0.55}>
        <path d={`M70 ${y - 6} Q73 ${y} 70 ${y + 6}`} />
        <path d="M104 46 Q107 48 108 52" />
      </g>
      <circle cx={68} cy={y} r={3.5} fill={tone} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// La mano desde arriba: los cinco dedos
// ---------------------------------------------------------------------------

/**
 * Mano derecha vista desde arriba, en un solo contorno: la muñeca entra por
 * abajo (y sale del dibujo), el pulgar se abre a la izquierda y los dedos se
 * separan con las membranas a distinta altura.
 */
const HAND_TOP_SILHOUETTE =
  "M62 206 C60 190 58 180 58 170 C48 160 32 142 22 122 C14 110 22 98 32 102 " +
  "C38 108 44 118 48 126 C52 124 54 116 54 104 C52 90 52 70 54 60 C55 46 73 46 74 60 " +
  "C76 74 76 90 74 104 C74 110 78 110 78 104 C77 88 77 56 78 46 C79 32 97 32 98 46 " +
  "C99 60 99 90 98 106 C98 112 102 112 102 106 C101 90 101 66 102 56 C103 42 121 42 122 56 " +
  "C123 70 123 96 122 112 C122 118 126 118 126 112 C125 102 125 92 126 86 C127 72 145 74 146 86 " +
  "C147 100 146 124 142 140 C136 160 128 184 124 206 Z";

/** Pliegues de las articulaciones, dos por dedo y uno en el pulgar y la muñeca. */
const HAND_TOP_CREASES = [
  "M57 74 Q64 71 71 74",
  "M57 90 Q64 87 71 90",
  "M81 62 Q88 59 95 62",
  "M81 82 Q88 79 95 82",
  "M105 72 Q112 69 119 72",
  "M105 92 Q112 89 119 92",
  "M129 100 Q136 97 143 100",
  "M129 114 Q136 111 143 114",
  "M27 132 Q34 127 41 124",
  "M70 190 Q92 184 116 190",
];

export function HandTopFigure({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 180 200"
      role="img"
      aria-label="Mano derecha vista desde arriba con los dedos numerados del 1 (pulgar) al 5 (meñique)."
      className={`w-full ${className}`}
    >
      <path d={HAND_TOP_SILHOUETTE} fill={PANEL} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <g fill="none" stroke={INK} strokeWidth={1.2} strokeLinecap="round" opacity={0.55}>
        {HAND_TOP_CREASES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <Badge x={27} y={112} n={1} />
      <Badge x={64} y={64} n={2} />
      <Badge x={88} y={52} n={3} />
      <Badge x={112} y={62} n={4} />
      <Badge x={136} y={92} n={5} />
    </svg>
  );
}
