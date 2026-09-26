"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Drag distance (px) or speed (px/ms) downward past which the sheet closes. */
const DISMISS_DISTANCE = 120;
const DISMISS_SPEED = 0.6;

/**
 * Sheet that slides up from the bottom edge, dimming what's underneath. A
 * `<dialog>`, so focus, Escape and the backdrop are handled by the browser;
 * also closes on backdrop tap or dragging the header down. Content scrolls
 * inside the sheet, with the header always visible.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  actions,
  maxHeight,
  keepMounted = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  /** Buttons to the right of the header, before the close button. */
  actions?: ReactNode;
  /**
   * Max height (any CSS value). Defaults to nearly full screen; with a long
   * list it helps to keep it lower so what triggered it stays visible.
   */
  maxHeight?: string;
  /**
   * Keeps the content mounted while closed (a closed `<dialog>` isn't shown),
   * for content that has to keep working out of sight — a running clock.
   */
  keepMounted?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ y: number; t: number; id: number } | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  /* header drag: the sheet follows the finger (downward only), and on
     release either snaps back or closes if dragged far or fast enough */
  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // no gesture over a button (X, actions): capturing the pointer here
    // would swallow the `click` and the button would never get it
    if ((e.target as HTMLElement).closest("button, a, input, select, textarea, [role='button']")) return;
    drag.current = { y: e.clientY, t: performance.now(), id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el || d.id !== e.pointerId) return;
    el.style.transition = "none";
    el.style.transform = `translateY(${Math.max(0, e.clientY - d.y)}px)`;
  };
  const onPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el || d.id !== e.pointerId) return;
    drag.current = null;
    const dy = Math.max(0, e.clientY - d.y);
    const speed = dy / Math.max(1, performance.now() - d.t);
    el.style.transition = "";
    el.style.transform = "";
    if (dy > DISMISS_DISTANCE || (dy > 24 && speed > DISMISS_SPEED)) onClose();
  };

  return (
    // `e.target === e.currentTarget` in onClose: `close` doesn't bubble in the
    // DOM, but React propagates it through its tree, so a modal nested inside
    // the sheet would close it too when it closes itself
    <dialog
      ref={ref}
      onClose={(e) => e.target === e.currentTarget && onClose()}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label={title}
      // inline because `.sheet > *` inherits max-height so content scrolls inside it
      style={maxHeight ? { maxHeight } : undefined}
      className="sheet"
    >
      {/* single column child: fixed header, scrolling content */}
      {(open || keepMounted) && (
        <div>
          <header
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="shrink-0 px-5 pt-2.5 pb-3 select-none [touch-action:none] cursor-grab active:cursor-grabbing"
          >
            <span className="block w-10 h-1.5 rounded-full bg-surface-3 mx-auto mb-3" aria-hidden />
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-lg leading-tight truncate">{title}</h2>
                {subtitle && <p className="text-xs text-ink-2 truncate mt-0.5">{subtitle}</p>}
              </div>
              {actions}
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="shrink-0 w-9 h-9 rounded-full text-ink-3 hover:text-ink hover:bg-surface-2 grid place-items-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ink/25"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </header>
          <div
            className="min-h-0 flex-1 overflow-y-auto px-4 pt-1 overscroll-contain"
            style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
          >
            {children}
          </div>
        </div>
      )}
    </dialog>
  );
}
