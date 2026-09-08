import type { Metadata } from "next";

/**
 * Central SEO config. The domain comes from `SITE_URL` (or
 * `NEXT_PUBLIC_SITE_URL`) — a *build*-time variable, since pages are
 * prerendered and the canonical URL/sitemap get written at compile time. In
 * Docker it's passed as `ARG SITE_URL`.
 */
const RAW_SITE_URL = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://opuspiano.app").trim();

export const SITE_URL = RAW_SITE_URL.replace(/\/+$/, "");
export const SITE_NAME = "Opus Piano";
export const SITE_TAGLINE = "Aprende a leer partituras y a tocar el piano";
export const SITE_LOCALE = "es_ES";
export const SITE_LANG = "es";

/** Kept at 56 chars on purpose: Google truncates the blue link around 60, and "Opus Piano" + "leer partituras" must survive. */
export const SITE_TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`;

// ---------------------------------------------------------------------------
// Authorship
// ---------------------------------------------------------------------------

/** App author: signs the metadata (`authors`, `creator`) and the JSON-LD. */
export const AUTHOR_NAME = "Axl Santos";

/** Author's public profile; used in the JSON-LD's `sameAs` and the footer signature. */
export const AUTHOR_URL = "https://github.com/snthz";

/** Studio that develops and publishes the app: `publisher`, and the footer. */
export const STUDIO_NAME = "FallxnStudio";

/** Studio site; `NEXT_PUBLIC_STUDIO_URL` overrides it if it ever changes. */
export const STUDIO_URL =
  (process.env.NEXT_PUBLIC_STUDIO_URL || "").trim().replace(/\/+$/, "") || "https://fallxn.studio";

/** Copyright year; same as in the LICENSE file. */
export const COPYRIGHT_YEAR = 2026;

export const SITE_DESCRIPTION =
  "Curso gratuito de lectura musical y piano en español: solfeo, claves, notas, figuras, compases, armaduras y todos los símbolos de la partitura, con ejercicios interactivos. Funciona sin conexión.";

/**
 * General site keywords; each page adds its own in `pageMetadata`. Goes from
 * generic/high-volume ("aprender piano") to long-tail, where a new app can
 * actually rank ("cómo leer partituras desde cero"), closing with brand terms.
 */
export const SITE_KEYWORDS = [
  // main intent: reading scores
  "aprender a leer partituras",
  "cómo leer partituras",
  "aprender a leer partituras desde cero",
  "leer música",
  "lectura musical",
  "lectura a primera vista",
  // solfège and music theory
  "solfeo",
  "solfeo online",
  "curso de solfeo gratis",
  "lenguaje musical",
  "teoría musical",
  "teoría musical para principiantes",
  // piano
  "aprender piano",
  "aprender piano desde cero",
  "curso de piano gratis",
  "clases de piano online gratis",
  "notas del piano",
  "teclado del piano",
  // score elements: each one is a lesson on the site
  "notas musicales",
  "pentagrama",
  "clave de sol",
  "clave de fa",
  "figuras musicales",
  "compases musicales",
  "armaduras de clave",
  "escalas musicales",
  "símbolos musicales",
  "signos de la partitura",
  "intervalos musicales",
  // format and usage
  "ejercicios de solfeo",
  "app para aprender a leer partituras",
  "app de música sin conexión",
  "partituras pdf y musicxml",
  "aprender música en español",
  // brand
  "opus piano",
  STUDIO_NAME,
  AUTHOR_NAME,
];

/** Absolute URL for an internal route ("/theory" → "https://…/theory"). */
export function absoluteUrl(path = "/"): string {
  if (!path.startsWith("/")) path = `/${path}`;
  // root has no trailing slash, matching how Next normalizes the canonical
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}

/**
 * Link-preview image. Declared on every page because `openGraph` doesn't
 * merge field by field — a page that sets its own `openGraph` replaces the
 * layout's entirely, image included.
 */
export const OG_IMAGE = {
  url: `${SITE_URL}/opengraph-image`,
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
  type: "image/png",
};

export interface PageSeo {
  /** Tab title; the layout appends " · Opus Piano". */
  title: string;
  /** 120-160 chars, keyword up front. */
  description: string;
  /** Internal route, for canonical and Open Graph. */
  path: string;
  keywords?: string[];
  /** "article" for lessons and detail pages; "website" for index pages. */
  type?: "website" | "article";
  /** Private pages (user data) or ones with no search value. */
  noindex?: boolean;
}

/**
 * Full page metadata: canonical, Open Graph and Twitter Card. Without a
 * canonical, the same content served with/without a trailing slash, with
 * `?utm_…`, or from another domain counts as a duplicate.
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
    // `authors` only exists on "article" Open Graph; on "website" it's undefined and Facebook drops it
    openGraph:
      type === "article"
        ? {
            type,
            url,
            siteName: SITE_NAME,
            locale: SITE_LOCALE,
            title: fullTitle,
            description,
            images: [OG_IMAGE],
            authors: [AUTHOR_NAME],
          }
        : {
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
// Structured data (JSON-LD)
// ---------------------------------------------------------------------------

export type JsonLdObject = Record<string, unknown>;

/** Breadcrumbs for Google: the path shown under the title in results. */
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

/**
 * Site identity: nodes with an `@id` that the rest of the JSON-LD points to
 * instead of repeating data. Google merges them into a single graph, so
 * authorship declared here applies to every page.
 */
export const WEBSITE_ID = `${SITE_URL}/#website`;
/** The studio publishing the app: FallxnStudio. */
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
/** The author: Axl Santos. */
export const PERSON_ID = `${SITE_URL}/#author`;

export function siteJsonLd(): JsonLdObject[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Person",
      "@id": PERSON_ID,
      name: AUTHOR_NAME,
      url: absoluteUrl("/"),
      sameAs: [AUTHOR_URL],
      jobTitle: "Desarrollador de software",
      worksFor: { "@id": ORGANIZATION_ID },
      knowsAbout: ["Lenguaje musical", "Solfeo", "Piano", "Notación musical", "Desarrollo web"],
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      name: STUDIO_NAME,
      url: STUDIO_URL,
      description: `Estudio de desarrollo de software, autor de ${SITE_NAME}.`,
      logo: absoluteUrl("/icons/icon-512.png"),
      founder: { "@id": PERSON_ID },
      // the brand belongs to the product; the studio just publishes it
      brand: {
        "@type": "Brand",
        name: SITE_NAME,
        slogan: SITE_TAGLINE,
        logo: absoluteUrl("/icons/icon-512.png"),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      name: SITE_NAME,
      alternateName: SITE_TITLE,
      url: absoluteUrl("/"),
      description: SITE_DESCRIPTION,
      inLanguage: SITE_LANG,
      publisher: { "@id": ORGANIZATION_ID },
      author: { "@id": PERSON_ID },
      creator: { "@id": PERSON_ID },
      copyrightYear: COPYRIGHT_YEAR,
      copyrightHolder: { "@id": ORGANIZATION_ID },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#webapp`,
      name: SITE_NAME,
      url: absoluteUrl("/"),
      description: SITE_DESCRIPTION,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web (PWA): Android, iOS, Windows, macOS, Linux",
      inLanguage: SITE_LANG,
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
      author: { "@id": PERSON_ID },
      creator: { "@id": PERSON_ID },
      publisher: { "@id": ORGANIZATION_ID },
      isPartOf: { "@id": WEBSITE_ID },
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

/** Glossary term entry: can show up as a featured definition. */
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
      url: absoluteUrl("/glossary"),
    },
    inLanguage: SITE_LANG,
  };
}

/** Theory lesson: a learning resource with its estimated time. */
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
    author: { "@id": PERSON_ID },
    provider: { "@id": ORGANIZATION_ID },
    isPartOf: { "@type": "Course", name: "Aprende a leer partituras", url: absoluteUrl("/theory") },
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
 * The theory track as a course. Google can show it in the courses block if
 * it declares provider, mode, workload and price.
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
    author: { "@id": PERSON_ID },
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
