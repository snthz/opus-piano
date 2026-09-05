import type { Metadata } from "next";

/**
 * Configuración central de SEO.
 *
 * El dominio se lee de `SITE_URL` (o `NEXT_PUBLIC_SITE_URL`). Es una variable de
 * *build*: las páginas se prerenderizan, así que la URL canónica y el sitemap se
 * escriben en el momento de compilar. En Docker se pasa como `ARG SITE_URL`.
 */
const RAW_SITE_URL = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://opuspiano.app").trim();

export const SITE_URL = RAW_SITE_URL.replace(/\/+$/, "");
export const SITE_NAME = "Opus Piano";
export const SITE_TAGLINE = "Aprende a leer partituras y a tocar el piano";
export const SITE_LOCALE = "es_ES";
export const SITE_LANG = "es";

export const SITE_DESCRIPTION =
  "Curso gratuito de lectura musical y piano en español: solfeo, claves, notas, figuras, compases, armaduras y todos los símbolos de la partitura, con ejercicios interactivos. Funciona sin conexión.";

/** Palabras clave generales; cada página añade las suyas. */
export const SITE_KEYWORDS = [
  "aprender a leer partituras",
  "solfeo",
  "lenguaje musical",
  "teoría musical",
  "aprender piano",
  "leer música",
  "notas musicales",
  "pentagrama",
  "clave de sol",
  "clave de fa",
  "curso de piano gratis",
];

/** URL absoluta de una ruta interna («/theory» → «https://…/theory»). */
export function absoluteUrl(path = "/"): string {
  if (!path.startsWith("/")) path = `/${path}`;
  // La raíz se escribe sin barra final, que es como la normaliza Next al
  // generar la canónica; así el sitemap y la canónica dicen exactamente lo mismo.
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}

/**
 * Imagen de vista previa al compartir un enlace. Se declara en cada página
 * porque `openGraph` no se hereda campo a campo: una página que define su
 * `openGraph` sustituye entero el del layout, imagen incluida.
 */
export const OG_IMAGE = {
  url: `${SITE_URL}/opengraph-image`,
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
  type: "image/png",
};

export interface PageSeo {
  /** Título de la pestaña; el layout le añade « · Opus Piano». */
  title: string;
  /** 120–160 caracteres, con la palabra clave al principio. */
  description: string;
  /** Ruta interna, para la canónica y para Open Graph. */
  path: string;
  keywords?: string[];
  /** «article» para lecciones y fichas; «website» para índices. */
  type?: "website" | "article";
  /** Páginas privadas (datos del usuario) o sin valor de búsqueda. */
  noindex?: boolean;
}

/**
 * Metadatos completos de una página: canónica, Open Graph y Twitter Card.
 * Sin canónica, el mismo contenido servido con y sin barra final, con `?utm_…`
 * o desde otro dominio cuenta como duplicado.
 */
export function pageMetadata({
  title,
  description,
  path,
  keywords,
  type = "website",
  noindex = false,
}: PageSeo): Metadata {
  const url = absoluteUrl(path);
  const fullTitle = `${title} · ${SITE_NAME}`;

  return {
    title,
    description,
    keywords: keywords?.length ? keywords : undefined,
    alternates: { canonical: url },
    robots: noindex
      ? { index: false, follow: true, googleBot: { index: false, follow: true } }
      : undefined,
    openGraph: {
      type,
      url,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      title: fullTitle,
      description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [OG_IMAGE.url],
    },
  };
}

// ---------------------------------------------------------------------------
// Datos estructurados (JSON-LD)
// ---------------------------------------------------------------------------

export type JsonLdObject = Record<string, unknown>;

/** Migas de pan para Google: la ruta que se ve bajo el título en los resultados. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** Identidad del sitio, referenciada por el resto de nodos con `@id`. */
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;

export function siteJsonLd(): JsonLdObject[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      name: SITE_NAME,
      url: absoluteUrl("/"),
      description: SITE_DESCRIPTION,
      logo: absoluteUrl("/icons/icon-512.png"),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      name: SITE_NAME,
      alternateName: `${SITE_NAME} — ${SITE_TAGLINE}`,
      url: absoluteUrl("/"),
      description: SITE_DESCRIPTION,
      inLanguage: SITE_LANG,
      publisher: { "@id": ORGANIZATION_ID },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: SITE_NAME,
      url: absoluteUrl("/"),
      description: SITE_DESCRIPTION,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web (PWA): Android, iOS, Windows, macOS, Linux",
      inLanguage: SITE_LANG,
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
      publisher: { "@id": ORGANIZATION_ID },
      featureList: [
        "Lecciones de lenguaje musical en español",
        "Ejercicios de lectura de notas, ritmo, solfeo y oído",
        "Catálogo de símbolos de la partitura con las fuentes SMuFL originales",
        "Biblioteca de partituras PDF y MusicXML en el propio dispositivo",
        "Funciona sin conexión",
      ],
    },
  ];
}

/** Ficha de término del glosario: puede salir como definición destacada. */
export function definedTermJsonLd(term: string, definition: string, path: string): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: term,
    description: definition,
    url: absoluteUrl(path),
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: "Glosario de términos musicales de Opus Piano",
      url: absoluteUrl("/glosario"),
    },
    inLanguage: SITE_LANG,
  };
}

/** Lección de teoría: recurso de aprendizaje con su tiempo estimado. */
export function learningResourceJsonLd(opts: {
  name: string;
  description: string;
  path: string;
  minutes: number;
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: opts.name,
    description: opts.description,
    url: absoluteUrl(opts.path),
    learningResourceType: "Lección",
    educationalLevel: "Principiante",
    timeRequired: `PT${opts.minutes}M`,
    inLanguage: SITE_LANG,
    isAccessibleForFree: true,
    teaches: opts.name,
    provider: { "@id": ORGANIZATION_ID },
    isPartOf: { "@type": "Course", name: "Aprende a leer partituras", url: absoluteUrl("/teoria") },
  };
}

export function faqJsonLd(items: { question: string; answer: string }[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/**
 * El itinerario de teoría como curso. Google puede mostrarlo en el bloque de
 * cursos si declara proveedor, modalidad, dedicación y precio.
 */
export function courseJsonLd(opts: {
  name: string;
  description: string;
  path: string;
  totalMinutes: number;
  sections: { name: string; description: string; path: string }[];
}): JsonLdObject {
  const hours = Math.max(1, Math.round(opts.totalMinutes / 60));
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: opts.name,
    description: opts.description,
    url: absoluteUrl(opts.path),
    inLanguage: SITE_LANG,
    isAccessibleForFree: true,
    educationalLevel: "Principiante",
    teaches: ["Lectura de partituras", "Lenguaje musical", "Solfeo", "Piano"],
    provider: { "@id": ORGANIZATION_ID },
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", category: "Free" },
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "online",
      courseWorkload: `PT${hours}H`,
      inLanguage: SITE_LANG,
    },
    syllabusSections: opts.sections.map((section, i) => ({
      "@type": "Syllabus",
      position: i + 1,
      name: section.name,
      description: section.description,
      url: absoluteUrl(section.path),
    })),
  };
}
