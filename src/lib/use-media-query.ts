"use client";

import { useEffect, useState } from "react";

/**
 * Whether a CSS media query matches, kept up to date as the window changes.
 * Reads the real value on the first render, so it's for client-only trees
 * (a server render has no window and would answer `false`).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}
