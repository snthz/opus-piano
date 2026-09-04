export interface GlossaryEntry {
  term: string;
  definition: string;
  /** Ruta a la lección relacionada */
  href?: string;
  /** Nombre del glifo SMuFL que ilustra el término */
  glyph?: string;
}

/** Términos musicales de la A a la Z, en español. */
export const GLOSSARY: GlossaryEntry[] = [
  { term: "Acorde", definition: "Tres o más notas que suenan a la vez. El más común es la tríada: fundamental, tercera y quinta.", href: "/teoria/escalas" },
  { term: "Adagio", definition: "Tempo lento y tranquilo, alrededor de 66–76 pulsos por minuto." },
  { term: "Allegro", definition: "Tempo rápido y alegre, alrededor de 120–168 pulsos por minuto." },
  { term: "Alteración", definition: "Signo que sube o baja la altura de una nota: sostenido, bemol o becuadro.", href: "/teoria/armaduras", glyph: "accidentalSharp" },
  { term: "Anacrusa", definition: "Una o varias notas antes del primer compás completo. La melodía empieza antes del tiempo fuerte.", href: "/teoria/compases" },
  { term: "Armadura", definition: "Los sostenidos o bemoles al principio del pentagrama que indican la tonalidad de la pieza.", href: "/teoria/armaduras" },
  { term: "Arpegio", definition: "Las notas de un acorde tocadas una tras otra en lugar de simultáneamente.", href: "/teoria/escalas" },
  { term: "Barra de compás", definition: "Línea vertical que separa un compás del siguiente.", href: "/teoria/compases", glyph: "barlineSingle" },
  { term: "Becuadro", definition: "Anula un sostenido o un bemol anterior y devuelve la nota a su altura natural.", href: "/teoria/armaduras", glyph: "accidentalNatural" },
  { term: "Bemol", definition: "Baja la nota un semitono.", href: "/teoria/armaduras", glyph: "accidentalFlat" },
  { term: "Blanca", definition: "Figura que dura dos pulsos en un compás de negra. Se escribe con la cabeza vacía y plica.", href: "/teoria/figuras", glyph: "noteHalfUp" },
  { term: "Calderón", definition: "Indica que la nota o el silencio se prolonga a voluntad del intérprete.", href: "/teoria/simbolos", glyph: "fermataAbove" },
  { term: "Clave", definition: "Signo al principio del pentagrama que fija la altura de las notas. Las más usadas al piano son la de sol y la de fa.", href: "/teoria/claves", glyph: "gClef" },
  { term: "Compás", definition: "Agrupación regular de pulsos delimitada por barras. La cifra indicadora dice cuántos y de qué figura.", href: "/teoria/compases" },
  { term: "Compás compuesto", definition: "Aquel cuyo pulso se divide en tres partes, como 6/8 o 9/8.", href: "/teoria/compases" },
  { term: "Corchea", definition: "Figura que dura medio pulso en un compás de negra. Lleva un corchete o va unida por barras.", href: "/teoria/figuras", glyph: "note8thUp" },
  { term: "Crescendo", definition: "Aumentar el volumen progresivamente.", href: "/teoria/simbolos", glyph: "dynamicCrescendoHairpin" },
  { term: "Diapasón", definition: "Referencia de afinación. El la central se afina normalmente a 440 Hz." },
  { term: "Diminuendo", definition: "Disminuir el volumen progresivamente. También se escribe decrescendo.", href: "/teoria/simbolos", glyph: "dynamicDiminuendoHairpin" },
  { term: "Enarmonía", definition: "Dos nombres distintos para el mismo sonido, como do sostenido y re bemol.", href: "/teoria/armaduras" },
  { term: "Escala", definition: "Sucesión ordenada de notas dentro de una tonalidad. La mayor sigue el patrón tono-tono-semitono-tono-tono-tono-semitono.", href: "/teoria/escalas" },
  { term: "Forte", definition: "Fuerte. Se indica con la letra f.", href: "/teoria/simbolos", glyph: "dynamicForte" },
  { term: "Grado", definition: "Posición de una nota dentro de la escala, del I al VII. El I es la tónica.", href: "/teoria/escalas" },
  { term: "Intervalo", definition: "Distancia entre dos notas, medida en grados y en semitonos. Por ejemplo, do–sol es una quinta justa.", href: "/teoria/escalas" },
  { term: "Legato", definition: "Tocar las notas unidas, sin separación entre ellas.", href: "/teoria/simbolos" },
  { term: "Ligadura de expresión", definition: "Curva que une notas de distinta altura e indica que se toquen legato.", href: "/teoria/simbolos" },
  { term: "Ligadura de prolongación", definition: "Curva que une dos notas de la misma altura: se tocan como una sola con la duración sumada.", href: "/teoria/figuras" },
  { term: "Línea adicional", definition: "Pequeña línea que extiende el pentagrama para escribir notas muy agudas o muy graves.", href: "/teoria/pentagrama" },
  { term: "Matiz", definition: "Indicación de intensidad del sonido, de pianissimo a fortissimo.", href: "/teoria/simbolos" },
  { term: "Metrónomo", definition: "Aparato o función que marca el pulso a una velocidad exacta en pulsos por minuto (bpm).", href: "/teoria/compases" },
  { term: "Modo mayor", definition: "Tonalidad de carácter luminoso, con la tercera a dos tonos de la tónica.", href: "/teoria/escalas" },
  { term: "Modo menor", definition: "Tonalidad de carácter más oscuro, con la tercera a tono y medio de la tónica.", href: "/teoria/escalas" },
  { term: "Negra", definition: "Figura que dura un pulso en los compases de negra. Es la unidad más habitual.", href: "/teoria/figuras", glyph: "noteQuarterUp" },
  { term: "Octava", definition: "Intervalo entre una nota y la siguiente del mismo nombre: doce semitonos. Suenan casi iguales.", href: "/teoria/notas" },
  { term: "Pedal", definition: "En el piano, el pedal derecho levanta los apagadores y prolonga el sonido.", href: "/teoria/piano", glyph: "keyboardPedalPed" },
  { term: "Pentagrama", definition: "Las cinco líneas y cuatro espacios donde se escribe la música.", href: "/teoria/pentagrama" },
  { term: "Piano", definition: "Suave. Se indica con la letra p. También el nombre del instrumento.", href: "/teoria/simbolos", glyph: "dynamicPiano" },
  { term: "Plica", definition: "La línea vertical unida a la cabeza de la nota. Sube o baja según la altura.", href: "/teoria/figuras" },
  { term: "Pulso", definition: "El latido regular de la música, lo que se sigue al dar palmas o llevar el pie.", href: "/teoria/compases" },
  { term: "Puntillo", definition: "Punto a la derecha de la figura: alarga su duración a la mitad de su valor.", href: "/teoria/figuras", glyph: "augmentationDot" },
  { term: "Redonda", definition: "Figura de mayor duración habitual: cuatro pulsos en compás de negra.", href: "/teoria/figuras", glyph: "noteWhole" },
  { term: "Semicorchea", definition: "Figura que dura un cuarto de pulso en compás de negra. Lleva dos corchetes.", href: "/teoria/figuras", glyph: "note16thUp" },
  { term: "Semitono", definition: "La distancia más pequeña del sistema: de una tecla a la contigua del piano, sea blanca o negra.", href: "/teoria/notas" },
  { term: "Silencio", definition: "Signo que indica un tiempo sin sonido, con la misma duración que su figura equivalente.", href: "/teoria/figuras", glyph: "restQuarter" },
  { term: "Síncopa", definition: "Nota que empieza en parte débil y se prolonga sobre la fuerte, desplazando el acento.", href: "/teoria/compases" },
  { term: "Sostenido", definition: "Sube la nota un semitono.", href: "/teoria/armaduras", glyph: "accidentalSharp" },
  { term: "Staccato", definition: "Punto sobre o bajo la nota: se toca corta y separada de la siguiente.", href: "/teoria/simbolos", glyph: "articStaccatoAbove" },
  { term: "Tempo", definition: "La velocidad a la que se toca la pieza, en pulsos por minuto o con palabras como andante o allegro." },
  { term: "Tesitura", definition: "El rango de notas, de la más grave a la más aguda, que abarca una pieza o un instrumento.", href: "/teoria/piano" },
  { term: "Tonalidad", definition: "El centro tonal de la pieza: la nota y el modo alrededor de los que gira la música.", href: "/teoria/armaduras" },
  { term: "Tónica", definition: "El primer grado de la escala y la nota que da nombre a la tonalidad. Es el punto de reposo.", href: "/teoria/escalas" },
  { term: "Tono", definition: "Distancia de dos semitonos. Do–re es un tono; mi–fa es solo un semitono.", href: "/teoria/notas" },
  { term: "Tresillo", definition: "Tres notas en el espacio de dos de la misma figura. Se marca con un 3.", href: "/teoria/figuras", glyph: "tuplet3" },
];

/** Agrupa las entradas por su letra inicial, ignorando tildes. */
export function groupByLetter(entries: GlossaryEntry[]): [string, GlossaryEntry[]][] {
  const groups = new Map<string, GlossaryEntry[]>();
  for (const e of entries) {
    const letter = e.term.normalize("NFD").replace(/\p{Diacritic}/gu, "")[0].toUpperCase();
    const list = groups.get(letter);
    if (list) list.push(e);
    else groups.set(letter, [e]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "es"));
}
