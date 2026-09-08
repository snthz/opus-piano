"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronIcon } from "./arrow-icon";

export type SelectOption<T extends string = string> = {
  value: T;
  label: ReactNode;
  /** Texto secundario a la derecha (p. ej. «recomendado»). */
  hint?: ReactNode;
  disabled?: boolean;
};

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: readonly SelectOption<T>[];
  /**
   * `field`: campo de formulario a todo el ancho (como los `<input>` de ajustes).
   * `pill`: píldora compacta, para filtros en línea.
   */
  variant?: "field" | "pill";
  className?: string;
  /** Etiqueta accesible cuando no hay un `<label>` alrededor. */
  "aria-label"?: string;
  disabled?: boolean;
};

/**
 * Sustituto del `<select>` nativo con el aspecto del sistema de diseño: el
 * desplegable es una tarjeta redondeada bajo el botón, con la opción activa en
 * tinta. Sigue el patrón ARIA de listbox (flechas, Inicio/Fin, Escape, Enter y
 * búsqueda por letra) y se cierra al pulsar fuera o al perder el foco.
 */
export function Select<T extends string>({ value, onChange, options, variant = "field", className = "", disabled, ...rest }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [above, setAbove] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const listId = useId();

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = options[selectedIndex];

  const openList = () => {
    if (disabled) return;
    setActive(Math.max(0, selectedIndex));
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };
  const choose = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    if (o.value !== value) onChange(o.value);
    close();
  };

  // Salta a la siguiente opción habilitada en la dirección indicada.
  const step = (from: number, dir: 1 | -1) => {
    let i = from;
    for (let n = 0; n < options.length; n++) {
      i = (i + dir + options.length) % options.length;
      if (!options[i].disabled) return i;
    }
    return from;
  };

  // Pulsar fuera cierra sin devolver el foco al botón.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const root = rootRef.current;
      const t = e.target as Node;
      // La <label> que envuelve al botón ya lo alterna al pulsarla.
      if (root && !root.contains(t) && !root.closest("label")?.contains(t)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Si no cabe por debajo, el desplegable se abre hacia arriba.
  useLayoutEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    const list = listRef.current;
    if (!button || !list) return;
    const rect = button.getBoundingClientRect();
    const needed = list.offsetHeight + 8;
    setAbove(window.innerHeight - rect.bottom < needed && rect.top > needed);
    list.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
    // Solo al abrir: el desplazamiento de la opción activa lo lleva el otro efecto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => step(i, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => step(i, -1));
        break;
      case "Home":
        e.preventDefault();
        setActive(step(-1, 1));
        break;
      case "End":
        e.preventDefault();
        setActive(step(0, -1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(active);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        setOpen(false);
        break;
      default: {
        if (e.key.length !== 1 || e.altKey || e.ctrlKey || e.metaKey) return;
        const now = e.timeStamp;
        const text = (now - typed.current.at < 600 ? typed.current.text : "") + e.key.toLowerCase();
        typed.current = { text, at: now };
        const from = text.length === 1 ? active + 1 : active;
        for (let n = 0; n < options.length; n++) {
          const i = (from + n) % options.length;
          const o = options[i];
          if (!o.disabled && optionText(o).toLowerCase().startsWith(text)) {
            setActive(i);
            break;
          }
        }
      }
    }
  };

  const isPill = variant === "pill";
  const buttonClass = isPill
    ? `pill py-1.5 pr-3 text-ink ${open ? "bg-surface-2" : ""}`
    : `w-full flex items-center gap-2 rounded-2xl px-3 py-2 text-sm text-left bg-surface-2 transition-shadow ${
        open ? "ring-2 ring-accent" : ""
      }`;

  return (
    <div
      ref={rootRef}
      className={`relative ${isPill ? "inline-block" : "block"} ${className}`}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={onKeyDown}
    >
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={rest["aria-label"]}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        className={`${buttonClass} focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50`}
      >
        <span className="flex-1 min-w-0 truncate">{selected ? selected.label : <span className="text-ink-3">Elige…</span>}</span>
        <ChevronIcon dir="down" className={`w-4 h-4 shrink-0 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          className={`absolute z-20 ${above ? "bottom-full mb-1.5" : "top-full mt-1.5"} ${
            isPill ? "left-0 min-w-full w-max max-w-[min(20rem,90vw)]" : "left-0 right-0"
          } card border border-line p-1.5 shadow-lg max-h-72 overflow-y-auto overscroll-contain text-sm animate-[fade-in_0.15s_ease]`}
        >
          {options.map((o, i) => {
            const isSelected = o.value === value;
            const isActive = i === active;
            return (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={isSelected}
                aria-disabled={o.disabled || undefined}
                onPointerMove={() => !o.disabled && setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer select-none transition-colors ${
                  o.disabled
                    ? "opacity-40 cursor-default"
                    : isSelected
                      ? "bg-ink text-bg"
                      : isActive
                        ? "bg-surface-2 text-ink"
                        : "text-ink"
                }`}
              >
                <span className="flex-1 min-w-0 truncate">{o.label}</span>
                {o.hint && <span className={`text-xs shrink-0 ${isSelected ? "text-bg/70" : "text-ink-3"}`}>{o.hint}</span>}
                {isSelected && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 shrink-0" aria-hidden>
                    <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Texto plano de una opción, para la búsqueda por letra. */
function optionText(o: SelectOption): string {
  return typeof o.label === "string" || typeof o.label === "number" ? String(o.label) : o.value;
}
