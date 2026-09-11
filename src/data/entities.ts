/**
 * Cada lección habla de un concepto que ya existe en las bases de conocimiento
 * públicas. Enlazarlo con `sameAs` no es decoración: es lo que le dice a un
 * buscador —y a un asistente de IA que lee el JSON-LD— *de qué* trata la página,
 * sin tener que deducirlo del texto. Una página que declara «esto es el
 * pentagrama, el mismo del que habla Wikipedia» se puede citar con seguridad;
 * una que no lo declara compite con todas las que usan la misma palabra.
 *
 * Solo entradas comprobadas: una URL rota aquí resta credibilidad al resto del
 * marcado. Todas devuelven 200 en es.wikipedia.org, y van con los acentos
 * codificados en porcentaje, que es la forma canónica de Wikipedia y la que
 * ningún analizador tiene que adivinar.
 */

export interface ConceptEntity {
  /** Nombre canónico del concepto, no el título de la lección. */
  name: string;
  /** Artículo de Wikipedia en español que define el concepto. */
  wikipedia: string;
}

/** Clave: slug de la lección en `lessons.ts` (en español, como los datos). */
export const LESSON_ENTITIES: Record<string, ConceptEntity> = {
  pentagrama: { name: "Pentagrama", wikipedia: "https://es.wikipedia.org/wiki/Pentagrama_(m%C3%BAsica)" },
  claves: { name: "Clave (música)", wikipedia: "https://es.wikipedia.org/wiki/Clave_(m%C3%BAsica)" },
  notas: { name: "Nota musical", wikipedia: "https://es.wikipedia.org/wiki/Nota_(m%C3%BAsica)" },
  figuras: { name: "Figura musical", wikipedia: "https://es.wikipedia.org/wiki/Figura_musical" },
  compases: { name: "Compás", wikipedia: "https://es.wikipedia.org/wiki/Comp%C3%A1s_(m%C3%BAsica)" },
  simbolos: { name: "Notación musical", wikipedia: "https://es.wikipedia.org/wiki/Notaci%C3%B3n_musical" },
  armaduras: { name: "Armadura de clave", wikipedia: "https://es.wikipedia.org/wiki/Armadura_(m%C3%BAsica)" },
  escalas: { name: "Escala musical", wikipedia: "https://es.wikipedia.org/wiki/Escala_musical" },
  postura: { name: "Postura corporal", wikipedia: "https://es.wikipedia.org/wiki/Postura_corporal" },
  piano: { name: "Piano", wikipedia: "https://es.wikipedia.org/wiki/Piano" },
};

/** Los temas del sitio entero: van en el `about` de la home y del curso. */
export const SITE_ENTITIES: ConceptEntity[] = [
  { name: "Lectura musical", wikipedia: "https://es.wikipedia.org/wiki/Solfeo" },
  { name: "Notación musical", wikipedia: "https://es.wikipedia.org/wiki/Notaci%C3%B3n_musical" },
  { name: "Teoría musical", wikipedia: "https://es.wikipedia.org/wiki/Teor%C3%ADa_musical" },
  { name: "Partitura", wikipedia: "https://es.wikipedia.org/wiki/Partitura" },
  { name: "Piano", wikipedia: "https://es.wikipedia.org/wiki/Piano" },
];
