/**
 * Iconos de la biblioteca de partituras. Comparten la base de trazo fino del
 * lector (`StrokeIcon`), así que heredan el color del texto y pesan lo mismo
 * en claro y en oscuro.
 */

import { StrokeIcon } from "./reader-icons";

interface Props {
  className?: string;
}

/** Añadir partitura: una hoja con un signo de más. */
export const AddScoreIcon = ({ className }: Props) => (
  <StrokeIcon className={className}>
    <path d="M13.2 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h4.6" />
    <path d="M13.2 3.5 18.5 8.8v2.4" />
    <path d="M13.2 3.5v5.3h5.3" />
    <circle cx="17.2" cy="17.2" r="4.3" />
    <path d="M17.2 15v4.4M15 17.2h4.4" />
  </StrokeIcon>
);

/** Menú de opciones de una tarjeta. */
export const DotsIcon = ({ className }: Props) => (
  <StrokeIcon className={className}>
    <circle cx="5.6" cy="12" r="1.55" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.55" fill="currentColor" stroke="none" />
    <circle cx="18.4" cy="12" r="1.55" fill="currentColor" stroke="none" />
  </StrokeIcon>
);

export const SearchIcon = ({ className }: Props) => (
  <StrokeIcon className={className}>
    <circle cx="11" cy="11" r="6.3" />
    <path d="m15.6 15.6 4 4" />
  </StrokeIcon>
);

/** Biblioteca vacía: un atril con la hoja todavía en blanco. */
export const EmptyLibraryIcon = ({ className }: Props) => (
  <StrokeIcon className={className}>
    <rect x="4.5" y="3.5" width="15" height="14" rx="2" />
    <path d="M8 8h8M8 11.5h8M8 15h5" opacity={0.55} />
    <path d="M12 17.5v3M8.5 20.5h7" />
  </StrokeIcon>
);
