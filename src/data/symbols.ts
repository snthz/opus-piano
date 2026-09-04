/**
 * Catálogo de símbolos de la partitura.
 * Cada símbolo se muestra con su glifo original del estándar SMuFL (fuente Bravura).
 * `glyph` es el nombre canónico SMuFL; el punto de código se genera en smufl-codepoints.ts.
 */

export interface SymbolEntry {
  id: string;
  glyph: string;
  /** Glifos adicionales que se muestran juntos (p. ej. barras de repetición) */
  extraGlyphs?: string[];
  name: string;
  alt?: string[];
  meaning: string;
  /** Consejo práctico para el pianista */
  tip?: string;
  /** Tamaño relativo del glifo en el catálogo (1 = normal) */
  scale?: number;
}

export interface SymbolCategory {
  id: string;
  title: string;
  intro: string;
  items: SymbolEntry[];
}

export const SYMBOL_CATEGORIES: SymbolCategory[] = [
  {
    id: "claves",
    title: "Claves",
    intro:
      "La clave se escribe al principio de cada pentagrama y fija el nombre de las notas en cada línea y espacio.",
    items: [
      {
        id: "clave-sol",
        glyph: "gClef",
        name: "Clave de sol",
        alt: ["clave de sol en segunda línea", "G clef", "treble clef"],
        meaning:
          "Su espiral rodea la segunda línea, que pasa a ser sol4. Es la clave de la mano derecha en el piano y de los instrumentos agudos.",
        tip: "En el piano se lee normalmente con la mano derecha.",
      },
      {
        id: "clave-fa",
        glyph: "fClef",
        name: "Clave de fa",
        alt: ["clave de fa en cuarta línea", "F clef", "bass clef"],
        meaning:
          "Sus dos puntos rodean la cuarta línea, que pasa a ser fa3. Es la clave de la mano izquierda y de los instrumentos graves.",
        tip: "Los dos puntos siempre abrazan la línea de fa.",
      },
      {
        id: "clave-do",
        glyph: "cClef",
        name: "Clave de do",
        alt: ["clave de do en tercera línea (contralto)", "clave de do en cuarta línea (tenor)", "C clef"],
        meaning:
          "Su centro señala la línea del do central (do4). En tercera línea se usa para la viola; en cuarta, para violonchelo, fagot y trombón en registro agudo.",
      },
      {
        id: "clave-sol-8vb",
        glyph: "gClef8vb",
        name: "Clave de sol octava baja",
        alt: ["G clef ottava bassa"],
        meaning: "Se lee como clave de sol pero suena una octava más grave. Habitual en guitarra y voz de tenor.",
      },
      {
        id: "clave-percusion",
        glyph: "unpitchedPercussionClef1",
        name: "Clave de percusión",
        alt: ["clave neutra"],
        meaning: "Indica instrumentos sin altura definida. Las líneas representan instrumentos, no notas.",
      },
    ],
  },
  {
    id: "figuras",
    title: "Figuras (duraciones)",
    intro:
      "Cada figura indica cuánto dura una nota. Cada una vale la mitad de la anterior.",
    items: [
      { id: "cuadrada", glyph: "noteDoubleWhole", name: "Cuadrada", alt: ["breve"], meaning: "Vale dos redondas (8 negras). Rara hoy en día; aparece en música antigua." },
      { id: "redonda", glyph: "noteWhole", name: "Redonda", alt: ["semibreve", "whole note"], meaning: "Vale 4 negras: un compás entero de 4/4. Cabeza blanca, sin plica." },
      { id: "blanca", glyph: "noteHalfUp", name: "Blanca", alt: ["mínima", "half note"], meaning: "Vale 2 negras. Cabeza blanca con plica." },
      { id: "negra", glyph: "noteQuarterUp", name: "Negra", alt: ["semínima", "quarter note"], meaning: "La unidad de pulso más habitual. Cabeza negra con plica." },
      { id: "corchea", glyph: "note8thUp", name: "Corchea", alt: ["eighth note"], meaning: "Vale media negra. Cabeza negra, plica y un corchete (o una barra si van agrupadas)." },
      { id: "semicorchea", glyph: "note16thUp", name: "Semicorchea", alt: ["sixteenth note"], meaning: "Vale un cuarto de negra. Dos corchetes o dos barras." },
      { id: "fusa", glyph: "note32ndUp", name: "Fusa", alt: ["thirty-second note"], meaning: "Vale un octavo de negra. Tres corchetes." },
      { id: "semifusa", glyph: "note64thUp", name: "Semifusa", alt: ["sixty-fourth note"], meaning: "Vale un dieciseisavo de negra. Cuatro corchetes." },
      { id: "puntillo", glyph: "noteQuarterUp", extraGlyphs: ["augmentationDot"], name: "Puntillo", alt: ["nota con puntillo", "dotted note"], meaning: "Un punto a la derecha de la cabeza añade la mitad del valor: negra con puntillo = 1½ negras. Un segundo puntillo añade la mitad del anterior." },
      { id: "tresillo", glyph: "tuplet3", name: "Tresillo", alt: ["triplet"], meaning: "Tres notas en el tiempo de dos de la misma figura. Se indica con un 3 sobre el grupo, a veces con un corchete.", scale: 1.6 },
    ],
  },
  {
    id: "silencios",
    title: "Silencios",
    intro: "Cada figura tiene un silencio equivalente: el mismo valor, pero sin sonido.",
    items: [
      { id: "silencio-redonda", glyph: "restWhole", name: "Silencio de redonda", meaning: "Cuelga de la cuarta línea. También se usa para un compás entero en silencio, sea cual sea el compás." },
      { id: "silencio-blanca", glyph: "restHalf", name: "Silencio de blanca", meaning: "Se apoya sobre la tercera línea. Vale 2 negras." },
      { id: "silencio-negra", glyph: "restQuarter", name: "Silencio de negra", meaning: "Vale 1 negra. Su forma serpenteante es fácil de reconocer." },
      { id: "silencio-corchea", glyph: "rest8th", name: "Silencio de corchea", meaning: "Vale ½ negra. Un solo «gancho»." },
      { id: "silencio-semicorchea", glyph: "rest16th", name: "Silencio de semicorchea", meaning: "Vale ¼ de negra. Dos ganchos." },
      { id: "silencio-fusa", glyph: "rest32nd", name: "Silencio de fusa", meaning: "Tres ganchos." },
      { id: "silencio-semifusa", glyph: "rest64th", name: "Silencio de semifusa", meaning: "Cuatro ganchos." },
      { id: "silencio-multiple", glyph: "restHBar", name: "Silencio de varios compases", alt: ["multirest"], meaning: "Barra gruesa con un número encima: cuántos compases enteros hay que esperar.", scale: 1.4 },
    ],
  },
  {
    id: "alteraciones",
    title: "Alteraciones",
    intro:
      "Modifican la altura de la nota. Se escriben a la izquierda de la cabeza y afectan a esa nota durante el resto del compás.",
    items: [
      { id: "sostenido", glyph: "accidentalSharp", name: "Sostenido", alt: ["♯", "sharp"], meaning: "Sube la nota medio tono. En el piano, normalmente la tecla negra de la derecha." },
      { id: "bemol", glyph: "accidentalFlat", name: "Bemol", alt: ["♭", "flat"], meaning: "Baja la nota medio tono. En el piano, normalmente la tecla negra de la izquierda." },
      { id: "becuadro", glyph: "accidentalNatural", name: "Becuadro", alt: ["♮", "natural"], meaning: "Anula un sostenido o bemol anterior (del compás o de la armadura)." },
      { id: "doble-sostenido", glyph: "accidentalDoubleSharp", name: "Doble sostenido", alt: ["𝄪"], meaning: "Sube la nota un tono entero. Fa𝄪 suena como sol." },
      { id: "doble-bemol", glyph: "accidentalDoubleFlat", name: "Doble bemol", alt: ["𝄫"], meaning: "Baja la nota un tono entero. Si𝄫 suena como la." },
      { id: "alteracion-precaucion", glyph: "accidentalParensLeft", extraGlyphs: ["accidentalNatural", "accidentalParensRight"], name: "Alteración de precaución", alt: ["cautionary accidental"], meaning: "Entre paréntesis: recuerda una alteración que ya está en vigor (o que ya no lo está) para evitar errores." },
    ],
  },
  {
    id: "compas",
    title: "Indicación de compás y barras",
    intro: "Tras la clave y la armadura se escribe el compás. Las barras verticales separan los compases.",
    items: [
      { id: "compasillo", glyph: "timeSigCommon", name: "Compasillo", alt: ["C", "common time"], meaning: "Equivale a 4/4." },
      { id: "compasillo-cortado", glyph: "timeSigCutCommon", name: "Compasillo cortado", alt: ["alla breve", "cut time"], meaning: "Equivale a 2/2: dos pulsos de blanca por compás." },
      { id: "barra-simple", glyph: "barlineSingle", name: "Barra de compás", meaning: "Separa un compás del siguiente.", scale: 1.3 },
      { id: "barra-doble", glyph: "barlineDouble", name: "Doble barra", meaning: "Marca el fin de una sección o un cambio de armadura o compás.", scale: 1.3 },
      { id: "barra-final", glyph: "barlineFinal", name: "Barra final", meaning: "Fin de la obra.", scale: 1.3 },
      { id: "repeticion-inicio", glyph: "repeatLeft", name: "Inicio de repetición", meaning: "Desde aquí se repite. Si no hay barra de inicio, se repite desde el principio.", scale: 1.3 },
      { id: "repeticion-fin", glyph: "repeatRight", name: "Fin de repetición", meaning: "Vuelve a la barra de inicio de repetición (o al principio) y toca de nuevo.", scale: 1.3 },
    ],
  },
  {
    id: "dinamicas",
    title: "Dinámicas",
    intro:
      "Indican la intensidad (volumen). Se escriben debajo del pentagrama en el piano, en cursiva. Cuantas más letras, más extremo.",
    items: [
      { id: "ppp", glyph: "dynamicPPP", name: "Pianississimo", alt: ["ppp"], meaning: "Lo más suave posible." },
      { id: "pp", glyph: "dynamicPP", name: "Pianissimo", alt: ["pp"], meaning: "Muy suave." },
      { id: "p", glyph: "dynamicPiano", name: "Piano", alt: ["p"], meaning: "Suave." },
      { id: "mp", glyph: "dynamicMP", name: "Mezzo piano", alt: ["mp"], meaning: "Medio suave." },
      { id: "mf", glyph: "dynamicMF", name: "Mezzo forte", alt: ["mf"], meaning: "Medio fuerte. Es la dinámica «por defecto» si no se indica otra." },
      { id: "f", glyph: "dynamicForte", name: "Forte", alt: ["f"], meaning: "Fuerte." },
      { id: "ff", glyph: "dynamicFF", name: "Fortissimo", alt: ["ff"], meaning: "Muy fuerte." },
      { id: "fff", glyph: "dynamicFFF", name: "Fortississimo", alt: ["fff"], meaning: "Lo más fuerte posible." },
      { id: "sfz", glyph: "dynamicSforzato", name: "Sforzato", alt: ["sfz", "sf"], meaning: "Acento fuerte y repentino en una sola nota o acorde." },
      { id: "fp", glyph: "dynamicFortePiano", name: "Forte-piano", alt: ["fp"], meaning: "Ataque fuerte y enseguida suave." },
      { id: "cresc", glyph: "dynamicCrescendoHairpin", name: "Crescendo", alt: ["cresc.", "regulador"], meaning: "Aumentar gradualmente el volumen. También se escribe cresc.", scale: 1.5 },
      { id: "dim", glyph: "dynamicDiminuendoHairpin", name: "Diminuendo", alt: ["dim.", "decresc."], meaning: "Disminuir gradualmente el volumen. También decresc. o dim.", scale: 1.5 },
      { id: "niente", glyph: "dynamicNiente", name: "Niente", alt: ["n"], meaning: "«Nada»: desde el silencio o hasta el silencio, junto a un regulador." },
    ],
  },
  {
    id: "articulaciones",
    title: "Articulaciones y acentos",
    intro: "Indican cómo se ataca y se separa cada nota. Se escriben junto a la cabeza de la nota.",
    items: [
      { id: "staccato", glyph: "articStaccatoAbove", name: "Staccato", meaning: "Nota corta y separada: se suelta en torno a la mitad de su valor.", tip: "Levanta el dedo pronto, sin golpear la tecla.", scale: 1.5 },
      { id: "staccatissimo", glyph: "articStaccatissimoAbove", name: "Staccatissimo", meaning: "Aún más corto y seco que el staccato.", scale: 1.5 },
      { id: "tenuto", glyph: "articTenutoAbove", name: "Tenuto", meaning: "Mantener la nota todo su valor, con un ligero apoyo.", scale: 1.5 },
      { id: "acento", glyph: "articAccentAbove", name: "Acento", meaning: "Atacar la nota con más fuerza que las de alrededor.", scale: 1.5 },
      { id: "marcato", glyph: "articMarcatoAbove", name: "Marcato", meaning: "Acento más fuerte y marcado, normalmente algo más corto.", scale: 1.5 },
      { id: "portato", glyph: "articTenutoStaccatoAbove", name: "Portato", alt: ["louré"], meaning: "Entre ligado y staccato: notas apoyadas y ligeramente separadas.", scale: 1.5 },
      { id: "calderon", glyph: "fermataAbove", name: "Calderón", alt: ["fermata"], meaning: "Prolongar la nota o el silencio a voluntad, más allá de su valor." },
      { id: "respiracion", glyph: "breathMarkComma", name: "Respiración", alt: ["coma"], meaning: "Pequeña pausa o separación de frase. En piano: levantar ligeramente las manos.", scale: 1.5 },
      { id: "cesura", glyph: "caesura", name: "Cesura", alt: ["railroad tracks"], meaning: "Corte breve del sonido y del pulso." },
    ],
  },
  {
    id: "adornos",
    title: "Adornos (ornamentos)",
    intro: "Notas rápidas añadidas para decorar la melodía.",
    items: [
      { id: "trino", glyph: "ornamentTrill", name: "Trino", alt: ["tr"], meaning: "Alternar rápidamente la nota escrita con la nota superior (normalmente un grado)." },
      { id: "mordente", glyph: "ornamentMordent", name: "Mordente inferior", alt: ["mordente"], meaning: "Nota escrita, nota inferior y de nuevo la escrita, muy rápido. La línea vertical indica «inferior»." },
      { id: "mordente-superior", glyph: "ornamentShortTrill", name: "Mordente superior", alt: ["pralltriller"], meaning: "Nota escrita, nota superior y de nuevo la escrita, muy rápido." },
      { id: "grupeto", glyph: "ornamentTurn", name: "Grupeto", alt: ["turn"], meaning: "Cuatro notas: superior, escrita, inferior, escrita." },
      { id: "grupeto-invertido", glyph: "ornamentTurnInverted", name: "Grupeto invertido", meaning: "Inferior, escrita, superior, escrita." },
      { id: "apoyatura", glyph: "graceNoteAppoggiaturaStemUp", name: "Apoyatura", alt: ["appoggiatura"], meaning: "Nota pequeña sin tachar: roba tiempo (normalmente la mitad) a la nota principal." },
      { id: "acciaccatura", glyph: "graceNoteAcciaccaturaStemUp", name: "Acciaccatura", alt: ["mordente de una nota"], meaning: "Nota pequeña tachada: se toca lo más rápido posible, casi junto con la principal." },
      { id: "arpegio", glyph: "arpeggiatoUp", name: "Arpegio", alt: ["arpeggiato"], meaning: "Línea ondulada delante de un acorde: tocar las notas una tras otra, rápidamente, de abajo arriba.", scale: 1.3 },
      { id: "glissando", glyph: "wiggleGlissando", extraGlyphs: ["wiggleGlissando", "wiggleGlissando"], name: "Glissando", alt: ["gliss."], meaning: "Deslizar el dedo por las teclas de una nota a otra.", scale: 1.3 },
    ],
  },
  {
    id: "repeticiones",
    title: "Repeticiones y navegación",
    intro: "Símbolos que indican saltos dentro de la partitura.",
    items: [
      { id: "segno", glyph: "segno", name: "Segno", alt: ["𝄋"], meaning: "Marca a la que se vuelve con «D.S.» (dal segno)." },
      { id: "coda", glyph: "coda", name: "Coda", alt: ["𝄌"], meaning: "Marca la sección final. «To Coda» o el símbolo indican saltar hasta aquí." },
      { id: "dc", glyph: "daCapo", name: "Da capo", alt: ["D.C."], meaning: "Volver al principio. «D.C. al Fine»: hasta la palabra Fine. «D.C. al Coda»: hasta el símbolo de coda y saltar.", scale: 0.9 },
      { id: "ds", glyph: "dalSegno", name: "Dal segno", alt: ["D.S."], meaning: "Volver al segno.", scale: 0.9 },
      { id: "repetir-compas", glyph: "repeat1Bar", name: "Repetir compás anterior", alt: ["simile"], meaning: "Repite exactamente el compás anterior." },
      { id: "repetir-dos-compases", glyph: "repeat2Bars", name: "Repetir dos compases", meaning: "Repite los dos compases anteriores." },
    ],
  },
  {
    id: "octavas",
    title: "Octavas",
    intro: "Para evitar demasiadas líneas adicionales se indica que un pasaje suena una octava más arriba o abajo de lo escrito.",
    items: [
      { id: "8va", glyph: "ottavaAlta", name: "Ottava alta", alt: ["8va"], meaning: "Tocar una octava más aguda de lo escrito, mientras dure la línea discontinua." },
      { id: "8vb", glyph: "ottavaBassaVb", name: "Ottava bassa", alt: ["8vb", "8va bassa"], meaning: "Tocar una octava más grave de lo escrito." },
      { id: "15ma", glyph: "quindicesimaAlta", name: "Quindicesima alta", alt: ["15ma"], meaning: "Dos octavas más aguda." },
    ],
  },
  {
    id: "pedal",
    title: "Pedal y teclado",
    intro: "Indicaciones específicas del piano.",
    items: [
      { id: "ped", glyph: "keyboardPedalPed", name: "Pedal (Ped.)", meaning: "Pisar el pedal derecho (de resonancia). Las notas siguen sonando aunque se suelten las teclas." },
      { id: "ped-up", glyph: "keyboardPedalUp", name: "Levantar pedal", alt: ["*"], meaning: "Soltar el pedal de resonancia." },
      { id: "sost", glyph: "keyboardPedalSost", name: "Pedal sostenuto", alt: ["sost."], meaning: "Pedal central: mantiene solo las notas que estaban pulsadas al pisarlo." },
      { id: "una-corda", glyph: "keyboardPedalHalf", name: "Medio pedal", meaning: "Pisar el pedal de resonancia solo hasta la mitad. (Para «una corda», el pedal izquierdo, se escribe la abreviatura u.c.)" },
      { id: "digitacion", glyph: "fingering1", extraGlyphs: ["fingering2", "fingering3", "fingering4", "fingering5"], name: "Digitación", meaning: "Números sobre o bajo las notas: 1 = pulgar, 2 = índice, 3 = corazón, 4 = anular, 5 = meñique. Igual en ambas manos.", scale: 1.2 },
    ],
  },
  {
    id: "estructura",
    title: "Estructura del pentagrama",
    intro: "Elementos que organizan el sistema.",
    items: [
      { id: "pentagrama", glyph: "staff5Lines", extraGlyphs: ["staff5Lines", "staff5Lines"], name: "Pentagrama", meaning: "Cinco líneas y cuatro espacios donde se escriben las notas. Se cuentan de abajo arriba.", scale: 1.2 },
      { id: "linea-adicional", glyph: "legerLine", name: "Línea adicional", alt: ["línea suplementaria"], meaning: "Pequeña línea para escribir notas por encima o por debajo del pentagrama.", scale: 1.5 },
      { id: "llave", glyph: "brace", name: "Llave", alt: ["brace"], meaning: "Une los dos pentagramas del piano (sistema o gran pentagrama).", scale: 1.6 },
      { id: "corchete", glyph: "bracket", name: "Corchete", alt: ["bracket"], meaning: "Agrupa pentagramas de una misma familia de instrumentos en una partitura de conjunto.", scale: 1.6 },
      { id: "metronomo", glyph: "metNoteQuarterUp", name: "Indicación metronómica", alt: ["♩ = 120"], meaning: "Una figura seguida de «= número»: cuántas de esas figuras caben en un minuto. ♩ = 60 es un pulso por segundo." },
      { id: "tremolo", glyph: "tremolo1", name: "Trémolo", meaning: "Barras en la plica: repetir la nota rápidamente (o alternar entre dos notas si las barras están entre ellas).", scale: 1.3 },
    ],
  },
];

export const ALL_SYMBOLS: SymbolEntry[] = SYMBOL_CATEGORIES.flatMap((c) => c.items);

export function symbolById(id: string): SymbolEntry | undefined {
  return ALL_SYMBOLS.find((s) => s.id === id);
}
