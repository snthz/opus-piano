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

/**
 * Título de la portada. Se deja en 56 caracteres a propósito: Google corta el
 * enlace azul alrededor de los 60 y «Opus Piano» y «leer partituras» son lo
 * que hay que ver sí o sí. El resto de la propuesta va en la descripción.
 */
export const SITE_TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`;

// ---------------------------------------------------------------------------
// Autoría
// ---------------------------------------------------------------------------

/** Autor de la app: firma los metadatos (`authors`, `creator`) y el JSON-LD. */
export const AUTHOR_NAME = "Axl Santos";

/**
 * Perfil público del autor. Va en `sameAs` del JSON-LD —el campo con el que
 * Google enlaza a una persona con sus perfiles— y en la firma del pie.
 */
export const AUTHOR_URL = "https://github.com/snthz";

/** Estudio que la desarrolla y publica: `publisher`, y el pie de página. */
export const STUDIO_NAME = "FallxnStudio";

/** Web del estudio; `NEXT_PUBLIC_STUDIO_URL` la sobreescribe si algún día cambia. */
export const STUDIO_URL =
  (process.env.NEXT_PUBLIC_STUDIO_URL || "").trim().replace(/\/+$/, "") || "https://fallxn.studio";

/** Año del aviso de copyright; el mismo que el del archivo LICENSE. */
export const COPYRIGHT_YEAR = 2026;

export const SITE_DESCRIPTION =
  "Curso gratuito de lectura musical y piano en español: solfeo, claves, notas, figuras, compases, armaduras y todos los símbolos de la partitura, con ejercicios interactivos. Funciona sin conexión.";

/**
 * Palabras clave generales del sitio; cada página añade las suyas en
 * `pageMetadata`. Van de lo genérico y muy buscado («aprender piano») a lo
 * long-tail, que es donde una app nueva puede posicionar de verdad
 * («cómo leer partituras desde cero»), y se cierran con las de marca.
 */
export const SITE_KEYWORDS = [
  // Intención principal: leer partituras.
  "aprender a leer partituras",
  "cómo leer partituras",
  "aprender a leer partituras desde cero",
  "leer música",
  "lectura musical",
  "lectura a primera vista",
  // Solfeo y lenguaje musical.
  "solfeo",
  "solfeo online",
  "curso de solfeo gratis",
  "lenguaje musical",
  "teoría musical",
  "teoría musical para principiantes",
  // Piano.
  "aprender piano",
  "aprender piano desde cero",
  "curso de piano gratis",
  "clases de piano online gratis",
  "notas del piano",
  "teclado del piano",
  // Elementos de la partitura: cada uno es una lección del sitio.
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
  // Formato y uso.
  "ejercicios de solfeo",
  "app para aprender a leer partituras",
  "app de música sin conexión",
  "partituras pdf y musicxml",
  "aprender música en español",
  // Marca.
  "opus piano",
  STUDIO_NAME,
  AUTHOR_NAME,
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
    // `authors` solo existe en el Open Graph de tipo «article»; en los índices
    // («website») la etiqueta no está definida y Facebook la descarta.
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

/**
 * Identidad del sitio: nodos con `@id` a los que apunta el resto del JSON-LD
 * en vez de repetir los datos. Google los une en un solo grafo, así que la
 * autoría declarada aquí vale para todas las páginas.
 */
export const WEBSITE_ID = `${SITE_URL}/#website`;
/** El estudio que publica la app: FallxnStudio. */
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
/** El autor: Axl Santos. */
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
      // La marca es del producto; el estudio es quien la publica.
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
      url: absoluteUrl("/glossary"),
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
