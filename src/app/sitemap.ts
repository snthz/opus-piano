import type { MetadataRoute } from "next";
import { CATALOG } from "@/data/catalog";
import { ALL_LESSONS } from "@/data/lessons";
import { EXERCISES } from "@/data/exercises";
import { GLOSSARY_SLUGS } from "@/data/glossary";
import { SYMBOL_CATEGORIES } from "@/data/symbols";
import { absoluteUrl } from "@/lib/seo";
import { exercisePath, lessonPath, symbolCategoryPath } from "@/lib/routes";

export const dynamic = "force-static";

type Entry = MetadataRoute.Sitemap[number];

/**
 * Fecha única para todo el sitemap: el contenido es estático y se publica con
 * cada despliegue, así que la fecha de compilación es la información honesta.
 */
const lastModified = new Date();

const entry = (path: string, priority: number, changeFrequency: Entry["changeFrequency"] = "monthly"): Entry => ({
  url: absoluteUrl(path),
  lastModified,
  changeFrequency,
  priority,
});

/**
 * Solo páginas indexables: quedan fuera /scores, /settings, /account, /login, /register y /offline,
 * que también están bloqueadas en robots.txt. /scores/catalog sí entra: son
 * piezas de dominio público, no datos de nadie.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    entry("/", 1, "weekly"),
    entry("/path", 0.9, "weekly"),
    entry("/guide", 0.9),
    entry("/theory", 0.9, "weekly"),
    ...ALL_LESSONS.map((lesson) => entry(lessonPath(lesson.slug), 0.8)),
    entry("/practice", 0.8, "weekly"),
    ...EXERCISES.map((exercise) => entry(exercisePath(exercise.id), 0.7)),
    entry("/scores/catalog", 0.8, "monthly"),
    ...CATALOG.map((piece) => entry(`/scores/catalog/${piece.id}`, 0.7)),
    entry("/metronome", 0.8),
    entry("/symbols", 0.8),
    ...SYMBOL_CATEGORIES.map((category) => entry(symbolCategoryPath(category.id), 0.7)),
    entry("/teacher", 0.7),
    entry("/glossary", 0.7, "weekly"),
    ...GLOSSARY_SLUGS.map(({ slug }) => entry(`/glossary/${slug}`, 0.6, "yearly")),
    entry("/faq", 0.7),
    entry("/more", 0.3, "yearly"),
  ];
}
