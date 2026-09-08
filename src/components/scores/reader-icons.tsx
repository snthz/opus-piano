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

export const MarkerIcon = ({ className }: Props) => (
  <StrokeIcon className={className}>
    <path d="m13 3.8 7.2 7.2-5.6 5.6H9.2L5.8 13.2z" />
    <path d="M4 20.5h16" strokeWidth={2.6} />
  </StrokeIcon>
);

export const EraserIcon = ({ className }: Props) => (
  <StrokeIcon className={className}>
    <path d="m13.4 4.2 6.4 6.4a1.7 1.7 0 0 1 0 2.4l-5.6 5.6H9l-4.8-4.8a1.7 1.7 0 0 1 0-2.4l7.6-7.2a1.7 1.7 0 0 1 2.6 0z" />
    <path d="m8.6 9 6.4 6.4" />
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

/** Plan de estudio: una lista con sus pasos marcados. */
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
