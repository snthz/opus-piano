/**
 * Iconos del panel de herramientas del lector. Trazo fino sobre una rejilla de
 * 24, sin relleno salvo en los que piden mancha (play, stop): así heredan el
 * color del botón y funcionan igual en claro y en oscuro.
 */

interface Props {
  className?: string;
}

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Base de trazo fino compartida por los iconos del lector y de la biblioteca. */
export function StrokeIcon({ className = "w-[18px] h-[18px]", children }: Props & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...STROKE}>
      {children}
    </svg>
  );
}

export const PenIcon = ({ className }: Props) => (
  <StrokeIcon className={className}>
    <path d="M4.5 19.5h3.2L19 8.2a2.3 2.3 0 0 0-3.2-3.2L4.5 16.3z" />
    <path d="m14.6 6.2 3.2 3.2" />
  </StrokeIcon>
);

/**
 * Delineador: la misma punta que el lápiz, más corta, y debajo la raya que
 * deja. Los tres van en familia y se distinguen por ella: el lápiz no lleva
 * ninguna, el delineador un hilo y el subrayador una banda.
 */
export const LinerIcon = ({ className }: Props) => (
  <StrokeIcon className={className}>
    <path d="M6.4 16.9h2.4l8.1-8.1a1.7 1.7 0 0 0-2.4-2.4l-8.1 8.1z" />
    <path d="m13.3 7.6 2.4 2.4" />
    <path d="M4 20.5h16" strokeWidth={1} />
  </StrokeIcon>
);

export const MarkerIcon = ({ className }: Props) => (
  <StrokeIcon className={className}>
    <path d="m13 3.8 7.2 7.2-5.6 5.6H9.2L5.8 13.2z" />
    <path d="M4 20.5h16" strokeWidth={2.6} />
  </StrokeIcon>
);

/** Goma de borrar inclinada, con su banda, apoyada en la línea que limpia. */
export const EraserIcon = ({ className }: Props) => (
  <StrokeIcon className={className}>
    <g transform="rotate(-45 12 11.5)">
      <rect x="4.5" y="8" width="15" height="7" rx="1.8" />
      <path d="M10 8v7" />
    </g>
    <path d="M12.5 20.5h8" />
  </StrokeIcon>
);

export const UndoIcon = ({ className }: Props) => (
  <StrokeIcon className={className}>
    <path d="M4 9.5h10.5a4.75 4.75 0 0 1 0 9.5H10" />
    <path d="m8 5-4 4.5 4 4.5" />
  </StrokeIcon>
);

export const MinusIcon = ({ className }: Props) => (
  <StrokeIcon className={className}>
    <path d="M6 12h12" strokeWidth={2} />
  </StrokeIcon>
);

export const PlusIcon = ({ className }: Props) => (
  <StrokeIcon className={className}>
    <path d="M12 6v12M6 12h12" strokeWidth={2} />
  </StrokeIcon>
);

export const PlayIcon = ({ className }: Props) => (
  <StrokeIcon className={className}>
    <path d="M8 5.4 19 12 8 18.6z" fill="currentColor" strokeWidth={2.4} />
  </StrokeIcon>
);

export const StopIcon = ({ className }: Props) => (
  <StrokeIcon className={className}>
    <rect x="6.8" y="6.8" width="10.4" height="10.4" rx="2.4" fill="currentColor" strokeWidth={1.4} />
  </StrokeIcon>
);

/** Digitación: un 3 posado encima de una nota en línea adicional. */
export const FingerIcon = ({ className }: Props) => (
  <StrokeIcon className={className}>
    <path d="M9.2 4.2h5.6l-3 3.5c1.9 0 3.3 1.1 3.3 2.6 0 1.7-1.4 2.8-3.1 2.8-1.3 0-2.4-.5-3-1.4" />
    <ellipse cx="12" cy="18.6" rx="3.1" ry="2.2" fill="currentColor" strokeWidth={1.2} />
    <path d="M6 18.6h12" />
  </StrokeIcon>
);

/** Análisis de la partitura: una lista con sus pasos marcados. */
export const PlanIcon = ({ className }: Props) => (
  <StrokeIcon className={className}>
    <path d="m3.5 7 1.7 1.7L8.5 5.4" />
    <path d="m3.5 16.5 1.7 1.7 3.3-3.3" />
    <path d="M11.5 7.5h9M11.5 16.5h9" />
  </StrokeIcon>
);

/** Guía que sigue el sonido sobre la página. */
export const GuideIcon = ({ className }: Props) => (
  <StrokeIcon className={className}>
    <path d="M12 3.5v17" strokeWidth={2.2} />
    <path d="M8 8.5 5 12l3 3.5M16 8.5l3 3.5-3 3.5" />
  </StrokeIcon>
);

/** Ver la partitura con los nombres de las notas. */
export const NoteNamesIcon = ({ className }: Props) => (
  <StrokeIcon className={className}>
    <circle cx="7.5" cy="16.5" r="3" />
    <path d="M10.5 16.5V4.5l8 2v10" />
    <circle cx="15.5" cy="18.5" r="3" />
  </StrokeIcon>
);

/** Ensayar un trozo: las barras de repetición. */
export const RehearseIcon = ({ className }: Props) => (
  <StrokeIcon className={className}>
    <path d="M4.5 4.5v15M8 4.5v15M20 4.5v15M16.5 4.5v15" />
    <circle cx="11.8" cy="9.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="11.8" cy="14.5" r="1" fill="currentColor" stroke="none" />
  </StrokeIcon>
);

/** Sesión de estudio: un cronómetro. */
export const SessionIcon = ({ className }: Props) => (
  <StrokeIcon className={className}>
    <circle cx="12" cy="13.5" r="7.5" />
    <path d="M12 9.5v4l2.5 1.5M9.5 2.5h5M12 2.5V6M18.5 6.5 20 5" />
  </StrokeIcon>
);

/** Chat con el profesor: un bocadillo de conversación. */
export const ChatIcon = ({ className }: Props) => (
  <StrokeIcon className={className}>
    <path d="M12 4.5c-4.7 0-8.5 3.1-8.5 7 0 2 1 3.8 2.7 5.1L5.5 20l4-1.5c.8.2 1.6.3 2.5.3 4.7 0 8.5-3.1 8.5-7s-3.8-7.3-8.5-7.3z" />
    <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" strokeWidth={2.6} />
  </StrokeIcon>
);

/** Enviar un mensaje: flecha hacia arriba. */
export const SendIcon = ({ className }: Props) => (
  <StrokeIcon className={className}>
    <path d="M12 19V5.5" strokeWidth={2.2} />
    <path d="m6 11.5 6-6 6 6" strokeWidth={2.2} />
  </StrokeIcon>
);

/** Cerrar o plegar: una cruz. */
export const CloseIcon = ({ className }: Props) => (
  <StrokeIcon className={className}>
    <path d="M6 6l12 12M18 6L6 18" strokeWidth={2} />
  </StrokeIcon>
);
