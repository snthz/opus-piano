"use client";

import { useEffect } from "react";
import { markLessonRead } from "@/lib/lessons-read";

/**
 * Deja constancia de que esta lección se ha abierto, para la ruta de
 * aprendizaje. No pinta nada: va dentro de `LessonLayout` para que cada
 * lección nueva lo herede sin acordarse de ponerlo.
 */
export function MarkLessonRead({ slug }: { slug: string }) {
  useEffect(() => markLessonRead(slug), [slug]);
  return null;
}
