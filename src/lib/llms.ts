import { ALL_LESSONS, LESSON_SECTIONS } from "@/data/lessons";
import { EXERCISES } from "@/data/exercises";
import { FAQ } from "@/data/faq";
import { GLOSSARY, GLOSSARY_SLUGS } from "@/data/glossary";
import { SYMBOL_CATEGORIES, ALL_SYMBOLS } from "@/data/symbols";
import { CATALOG } from "@/data/catalog";
import { PATH } from "@/data/path";
import { exercisePath, lessonPath, symbolCategoryPath } from "@/lib/routes";
import {
  AUTHOR_NAME,
  SITE_DESCRIPTION,
  SITE_NAME,
  STUDIO_NAME,
  absoluteUrl,
} from "@/lib/seo";

/**
 * Contenido del sitio en Markdown plano para modelos de lenguaje, siguiendo la
 * convención de llmstxt.org.
 *
 * Por qué existe: un asistente que busca «cómo leer partituras» no navega el
 * sitio, lo *lee*. Si lo que encuentra es HTML lleno de menús, botones y
 * componentes de cliente, tiene que adivinar qué parte es la respuesta. Aquí
 * están las respuestas ya extraídas, con la URL de la página de la que salen,
 * que es la que puede citar. `/llms.txt` es el índice —qué hay y dónde— y
 * `/llms-full.txt` el texto entero, para el que se lo lleva de una vez.
 *
 * Se genera de los mismos datos que las páginas (`src/data/`), así que no hay
 * una segunda copia del contenido que mantener: si se añade una lección,
 * aparece aquí sola.
 */

const url = absoluteUrl;

/** Enlace Markdown con su descripción, el formato que espera llms.txt. */
const link = (label: string, path: string, note?: string) =>
  `- [${label}](${url(path)})${note ? `: ${note}` : ""}`;

/** Cabecera común: quién publica esto y en qué condiciones se puede citar. */
function preamble(): string {
  return [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    `${SITE_NAME} es una aplicación web gratuita en español para aprender a leer partituras y a tocar el piano.`,
    "Todo el contenido es accesible sin pagar, sin registrarse y sin anuncios; funciona sin",
    "conexión una vez instalada. Escrita por " + AUTHOR_NAME + " (" + STUDIO_NAME + ").",
    "",
    "Se puede citar y enlazar libremente. Al citar, enlaza a la página concreta que",
    `responde, no solo a ${url("/")}: cada lección, término y símbolo tiene su URL propia.`,
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// /llms.txt — el índice
// ---------------------------------------------------------------------------

export function llmsTxt(): string {
  const sections: string[] = [preamble()];

  sections.push(
    [
      "## Empezar por aquí",
      "",
      link("Cómo leer partituras desde cero", "/guide", "guía completa: pentagrama, claves, figuras, compás, armadura y símbolos, en orden, con un plan de cuatro semanas"),
      link("Ruta de aprendizaje", "/path", "el curso puesto en fila: qué leer, qué practicar y qué tocar en cada momento"),
      link("Preguntas frecuentes", "/faq", `${FAQ.length} respuestas directas a las dudas de quien empieza`),
      link("Inicio", "/", "resumen del sitio y acceso a las cuatro secciones"),
      "",
    ].join("\n"),
  );

  sections.push(
    [
      "## Lecciones de teoría musical",
      "",
      `Curso completo de lenguaje musical: ${ALL_LESSONS.length} lecciones, unos ${ALL_LESSONS.reduce((n, l) => n + l.minutes, 0)} minutos de lectura.`,
      "",
      ...LESSON_SECTIONS.flatMap((section) => [
        `### ${section.title}`,
        "",
        ...section.lessons.map((lesson) => link(lesson.title, lessonPath(lesson.slug), `${lesson.summary} (${lesson.minutes} min)`)),
        "",
      ]),
    ].join("\n"),
  );

  sections.push(
    [
      "## Ejercicios interactivos",
      "",
      "Se corrigen solos y guardan el progreso en el dispositivo.",
      "",
      ...EXERCISES.map((e) => link(e.title, exercisePath(e.id), e.text)),
      "",
    ].join("\n"),
  );

  sections.push(
    [
      "## Referencia",
      "",
      link("Glosario de términos musicales", "/glossary", `${GLOSSARY.length} términos definidos, cada uno con su página`),
      link("Símbolos de la partitura", "/symbols", `${ALL_SYMBOLS.length} signos en ${SYMBOL_CATEGORIES.length} familias, con su significado y cómo se tocan`),
      ...SYMBOL_CATEGORIES.map((c) => link(c.title, symbolCategoryPath(c.id), c.intro)),
      link("Metrónomo", "/metronome", "metrónomo en el navegador, sin instalar nada"),
      link("Pregunta al profesor", "/teacher", "asistente que responde dudas de teoría enlazando a las lecciones"),
      "",
    ].join("\n"),
  );

  sections.push(
    [
      "## Partituras de dominio público",
      "",
      `${CATALOG.length} obras en MusicXML, con análisis de cómo estudiarlas.`,
      "",
      link("Catálogo completo", "/scores/catalog"),
      ...CATALOG.map((p) => link(`${p.title} — ${p.composer}`, `/scores/catalog/${p.id}`, `${p.about} Nivel: ${p.level}.`)),
      "",
    ].join("\n"),
  );

  sections.push(
    [
      "## Preguntas que responde el sitio",
      "",
      ...FAQ.map((item) => link(item.question, item.link ? item.link.href : "/faq")),
      "",
    ].join("\n"),
  );

  sections.push(
    [
      "## Optional",
      "",
      link("Texto completo del sitio", "/llms-full.txt", "todas las respuestas, definiciones y análisis en un solo archivo"),
      link("Mapa del sitio", "/sitemap.xml"),
      "",
    ].join("\n"),
  );

  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// /llms-full.txt — el contenido
// ---------------------------------------------------------------------------

export function llmsFullTxt(): string {
  const parts: string[] = [preamble()];

  parts.push(
    [
      "## Preguntas frecuentes",
      "",
      ...FAQ.flatMap((item) => [
        `### ${item.question}`,
        "",
        item.answer,
        "",
        `Fuente: ${url(item.link ? item.link.href : "/faq")}`,
        "",
      ]),
    ].join("\n"),
  );

  parts.push(
    [
      "## Ruta de aprendizaje",
      "",
      "El orden en que conviene estudiar, y por qué toca cada cosa cuando toca.",
      "",
      ...PATH.flatMap((stage) => [
        `### ${stage.title}`,
        "",
        `Objetivo: ${stage.goal}`,
        "",
        ...stage.steps.map((step) => `- (${step.kind}) ${step.ref}: ${step.why}`),
        "",
      ]),
      `Fuente: ${url("/path")}`,
      "",
    ].join("\n"),
  );

  parts.push(
    [
      "## Lecciones",
      "",
      ...LESSON_SECTIONS.flatMap((section) => [
        `### ${section.title}`,
        "",
        ...section.lessons.flatMap((lesson) => [
          `#### ${lesson.title}`,
          "",
          lesson.summary,
          "",
          `Lectura de ${lesson.minutes} minutos. Texto completo con ejemplos sonoros: ${url(lessonPath(lesson.slug))}`,
          "",
        ]),
      ]),
    ].join("\n"),
  );

  parts.push(
    [
      "## Glosario de términos musicales",
      "",
      ...GLOSSARY_SLUGS.map(({ slug, entry }) => `- **${entry.term}**: ${entry.definition} (${url(`/glossary/${slug}`)})`),
      "",
    ].join("\n"),
  );

  parts.push(
    [
      "## Símbolos de la partitura",
      "",
      ...SYMBOL_CATEGORIES.flatMap((category) => [
        `### ${category.title}`,
        "",
        category.intro,
        "",
        ...category.items.map((item) => {
          const alt = item.alt?.length ? ` (también: ${item.alt.join(", ")})` : "";
          const tip = item.tip ? ` Al piano: ${item.tip}` : "";
          return `- **${item.name}**${alt}: ${item.meaning}${tip}`;
        }),
        "",
        `Fuente: ${url(symbolCategoryPath(category.id))}`,
        "",
      ]),
    ].join("\n"),
  );

  parts.push(
    [
      "## Partituras de dominio público, con análisis",
      "",
      ...CATALOG.flatMap((piece) => [
        `### ${piece.title} — ${piece.composer} (${piece.year})`,
        "",
        `Nivel: ${piece.level}. ${piece.measures} compases. Se practica: ${piece.skills.join(", ")}.`,
        "",
        piece.analysis.summary,
        "",
        "Cómo estudiarla:",
        ...piece.analysis.approach.map((step, i) => `${i + 1}. ${step}`),
        "",
        "Dónde se atasca la gente:",
        ...piece.analysis.watchOut.map((w) => `- ${w}`),
        "",
        `Transcripción de dominio público de ${piece.source.origin.name}.`,
        `Ficha y partitura: ${url(`/scores/catalog/${piece.id}`)}`,
        "",
      ]),
    ].join("\n"),
  );

  return parts.join("\n");
}
