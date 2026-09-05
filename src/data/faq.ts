export interface FaqItem {
  question: string;
  /** Texto plano: es lo que se envía a Google en el JSON-LD de FAQPage. */
  answer: string;
  /** Enlace de ampliación que se muestra bajo la respuesta. */
  link?: { href: string; label: string };
}

/**
 * Preguntas reales que la gente escribe en el buscador antes de empezar.
 * Las respuestas son autosuficientes: cada una se entiende sin leer las demás,
 * porque Google puede mostrar una sola dentro de un resultado desplegable.
 */
export const FAQ: FaqItem[] = [
  {
    question: "¿Cómo se aprende a leer partituras desde cero?",
    answer:
      "Por orden: primero el pentagrama (las cinco líneas y los cuatro espacios), después la clave, que decide qué nota es cada línea, y solo entonces las figuras, que dicen cuánto dura cada nota. Con esos tres elementos ya se puede leer una melodía sencilla. Los compases, las armaduras y los símbolos de expresión vienen después. La clave está en leer un poco cada día en lugar de mucho un día: diez minutos diarios rinden más que dos horas el domingo.",
    link: { href: "/guide", label: "Guía completa para leer partituras" },
  },
  {
    question: "¿Cuánto se tarda en aprender a leer música?",
    answer:
      "Reconocer las notas de la clave de sol sin contar líneas cuesta entre dos y cuatro semanas practicando diez minutos al día. Leer con las dos manos a la vez, con su ritmo y sus alteraciones, es cuestión de unos meses. No es memoria, es reconocimiento: lo que hace falta son muchas repeticiones cortas, no sesiones largas.",
    link: { href: "/practice/notes", label: "Practicar la lectura de notas" },
  },
  {
    question: "¿Cuál es la diferencia entre la clave de sol y la clave de fa?",
    answer:
      "Las dos son señales que fijan una nota de referencia en el pentagrama. La clave de sol rodea con su espiral la segunda línea, que pasa a ser sol4; se usa para los sonidos agudos y, al piano, para la mano derecha. La clave de fa marca con sus dos puntos la cuarta línea, que pasa a ser fa3; se usa para los graves y, al piano, para la mano izquierda. La misma línea significa notas distintas según la clave, y por eso hay que aprender a leer las dos.",
    link: { href: "/theory/clefs", label: "Lección sobre las claves" },
  },
  {
    question: "¿Qué significan los dos números del principio de una partitura?",
    answer:
      "Son la indicación de compás. El número de arriba dice cuántos pulsos entran en cada compás y el de abajo, qué figura vale un pulso: 4 es la negra, 8 la corchea, 2 la blanca. Así, 3/4 son tres negras por compás, el vals de toda la vida; 6/8 son seis corcheas agrupadas de tres en tres. No es una fracción: no se lee «tres cuartos», se lee «tres por cuatro».",
    link: { href: "/theory/measures", label: "Lección sobre los compases" },
  },
  {
    question: "¿Para qué sirven los sostenidos y bemoles del principio del pentagrama?",
    answer:
      "Son la armadura, y dicen en qué tonalidad está la pieza. Se aplican a todas las notas de ese nombre durante toda la obra, en cualquier octava, sin que haga falta repetir el signo. Un fa sostenido en la armadura significa que todos los fa se tocan sostenidos hasta que aparezca un becuadro. Cada tonalidad tiene su combinación, y el círculo de quintas es el mapa que las ordena.",
    link: { href: "/theory/key-signatures", label: "Lección sobre las armaduras" },
  },
  {
    question: "¿Qué es el solfeo y hace falta para tocar el piano?",
    answer:
      "Solfear es leer las notas en voz alta con su nombre y su ritmo, sin instrumento. No es obligatorio para tocar, pero acelera muchísimo el proceso: separa el problema de leer del problema de mover los dedos, y así se resuelven de uno en uno en lugar de los dos a la vez. Quien solfea antes de sentarse al teclado suele aprender una pieza en bastante menos tiempo.",
    link: { href: "/practice/solfege", label: "Ejercicios de solfeo" },
  },
  {
    question: "¿Se puede aprender a tocar el piano sin profesor?",
    answer:
      "La lectura musical y la teoría se aprenden perfectamente por cuenta propia: son conocimiento y repetición, y se puede comprobar uno mismo si acierta. La técnica es lo que conviene revisar de vez en cuando con alguien, porque una postura de mano o de muñeca mal cogida se automatiza sin darse cuenta y luego cuesta corregirla. Una combinación razonable es estudiar la lectura por libre y consultar la técnica cada cierto tiempo.",
    link: { href: "/theory/piano", label: "Técnica básica del piano" },
  },
  {
    question: "¿Hace falta tener un piano para practicar?",
    answer:
      "Para la lectura, el ritmo, el solfeo y el reconocimiento de símbolos no hace falta ningún instrumento: se practica con la pantalla y con las palmas. Para la parte de teclado, cualquier teclado sirve, incluso el de la propia aplicación con el ratón o el dedo. Un piano de verdad es necesario para trabajar el sonido y el peso de la pulsación, pero eso llega más tarde.",
    link: { href: "/practice/keyboard", label: "Practicar en el teclado" },
  },
  {
    question: "¿Opus Piano es gratis?",
    answer:
      "Sí, entero y sin cuentas de pago: todas las lecciones, todos los ejercicios y la biblioteca de partituras están disponibles sin coste. El código es libre, con licencia MIT. No hay anuncios ni versión de pago con el contenido bueno detrás.",
  },
  {
    question: "¿Funciona sin conexión a internet?",
    answer:
      "Sí. Opus Piano es una aplicación web progresiva (PWA): al instalarla en el móvil o el ordenador se guarda en el dispositivo y las lecciones y ejercicios que ya has visitado siguen funcionando sin cobertura. El progreso se sincroniza solo cuando vuelve a haber red.",
  },
  {
    question: "¿Puedo leer mis propias partituras en PDF?",
    answer:
      "Sí. Se pueden subir partituras en PDF y en MusicXML, leerlas a pantalla completa, anotarlas y guardarlas en la biblioteca. Los archivos se quedan en el almacenamiento del propio dispositivo, no se suben a ningún servidor.",
    link: { href: "/scores", label: "Abrir mis partituras" },
  },
  {
    question: "¿Qué pasa con mis datos y mi progreso?",
    answer:
      "Las partituras que subes se guardan solo en tu dispositivo. Del progreso de práctica se guarda lo justo para llevar la cuenta de aciertos y rachas, y se puede vincular otro dispositivo para continuar donde lo dejaste. No se venden datos ni hay rastreadores publicitarios.",
  },
];
